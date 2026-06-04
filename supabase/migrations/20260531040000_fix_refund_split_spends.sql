-- Fix: users permanently lost credits when an AI generation failed on a
-- higher-tier model.
--
-- Root cause: AI flows charge credits as TWO separate transactions — a base
-- cost and a model "tier surcharge" — recorded as two rows in
-- credit_transactions (e.g. -3 and -2). On failure the application refunds the
-- COMBINED cost in one call: refund_credits(_amount => 5). The previous
-- refund_credits required a single spend row whose amount exactly matched
-- -_amount, so refunding 5 against rows of -3 and -2 raised 'no_refundable_spend'
-- and the refund was silently dropped — the user kept the deduction.
--
-- This rewrite refunds the requested amount as long as the user has at least
-- that much recent (<2h) net un-refunded ai_spend, instead of demanding one
-- exact-match row. Double-refund protection is preserved by subtracting prior
-- refunds in the same window, and the per-call amount cap is unchanged.

CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer, _reason text DEFAULT 'refund')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new int;
  _spent int;
  _refunded int;
  _clean_reason text := left(coalesce(nullif(trim(_reason), ''), 'refund'), 120);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 10000 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;
  IF public.has_role(_uid, 'owner') THEN RETURN 999999; END IF;

  -- Total genuinely spent on AI in the last 2 hours (as a positive number).
  SELECT COALESCE(SUM(-amount), 0)
    INTO _spent
  FROM public.credit_transactions
  WHERE user_id = _uid
    AND amount < 0
    AND reason = 'ai_spend'
    AND created_at > now() - interval '2 hours';

  -- Total already refunded in the same window (positive number).
  SELECT COALESCE(SUM(amount), 0)
    INTO _refunded
  FROM public.credit_transactions
  WHERE user_id = _uid
    AND amount > 0
    AND reason LIKE 'refund:%'
    AND created_at > now() - interval '2 hours';

  -- Only refund what is still owed, so repeated calls can't over-credit.
  IF (_spent - _refunded) < _amount THEN
    RAISE EXCEPTION 'no_refundable_spend';
  END IF;

  UPDATE public.profiles
  SET credits = credits + _amount, updated_at = now()
  WHERE id = _uid
  RETURNING credits INTO _new;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (_uid, _amount, _new, 'refund:' || _clean_reason);

  RETURN _new;
END
$$;

REVOKE EXECUTE ON FUNCTION public.refund_credits(integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated, service_role;
