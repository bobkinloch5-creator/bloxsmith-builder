-- Add the missing credit RPCs that the app code calls.
-- spend_credits_atomic: atomic deduction returning void; raises on insufficient balance.
CREATE OR REPLACE FUNCTION public.spend_credits_atomic(_amount integer, _description text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _new_balance integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.user_credits
    SET balance = balance - _amount,
        lifetime_spent = lifetime_spent + _amount,
        updated_at = now()
    WHERE user_id = _user_id AND balance >= _amount
    RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, tx_type, description, metadata)
    VALUES (_user_id, -_amount, 'spend', COALESCE(_description, 'spend'), COALESCE(_metadata, '{}'::jsonb));
END;
$$;

-- refund_credits: add credits back to current user, log a refund transaction.
CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer, _reason text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN;
  END IF;

  -- Ensure a row exists, then credit it.
  INSERT INTO public.user_credits (user_id, balance) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_credits
    SET balance = balance + _amount,
        lifetime_spent = GREATEST(0, lifetime_spent - _amount),
        updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, tx_type, description, metadata)
    VALUES (_user_id, _amount, 'refund', COALESCE(_reason, 'refund'), COALESCE(_metadata, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_credits_atomic(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text, jsonb) TO authenticated;
