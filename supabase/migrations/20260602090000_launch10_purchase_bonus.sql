ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'credits',
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS minimum_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all';

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS discounted_amount numeric,
  ADD COLUMN IF NOT EXISTS promo_type text,
  ADD COLUMN IF NOT EXISTS bonus_percent integer,
  ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_purchase_discount(
  _code text,
  _amount numeric,
  _pack_id text DEFAULT 'custom',
  _credits integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.promo_codes;
  _clean text := upper(trim(coalesce(_code, '')));
  _pack text := lower(trim(coalesce(_pack_id, 'custom')));
  _original numeric := round(greatest(coalesce(_amount, 0), 0), 2);
  _base_credits integer := greatest(coalesce(_credits, 0), 0);
  _percent integer;
  _discount numeric;
  _final numeric;
  _bonus_credits integer := 0;
BEGIN
  IF _clean = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty_code');
  END IF;

  SELECT *
    INTO _p
    FROM public.promo_codes
   WHERE lower(code) = lower(_clean)
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'code_not_found');
  END IF;
  IF _p.promo_type NOT IN ('purchase_discount', 'purchase_bonus') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_a_purchase_promo');
  END IF;
  IF NOT _p.active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'code_disabled');
  END IF;
  IF _p.expires_at IS NOT NULL AND _p.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'code_expired');
  END IF;
  IF _p.max_redemptions IS NOT NULL AND _p.redemption_count >= _p.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'code_used_up');
  END IF;
  IF _original < coalesce(_p.minimum_amount, 0) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'minimum_not_met',
      'minimumAmount', coalesce(_p.minimum_amount, 0)
    );
  END IF;
  IF _p.applies_to <> 'all'
     AND _p.applies_to <> _pack
     AND _p.applies_to <> ('pack:' || _pack)
     AND NOT (_p.applies_to = 'custom' AND _pack LIKE 'custom%') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_for_this_pack');
  END IF;

  _percent := least(greatest(coalesce(_p.discount_percent, 0), 1), 95);

  IF _p.promo_type = 'purchase_discount' THEN
    _discount := round(_original * _percent / 100.0, 2);
    _final := round(greatest(_original - _discount, 0.50), 2);

    RETURN jsonb_build_object(
      'valid', true,
      'promoType', 'purchase_discount',
      'code', _p.code,
      'discountPercent', _percent,
      'discountAmount', _discount,
      'originalAmount', _original,
      'finalAmount', _final,
      'expiresAt', _p.expires_at,
      'remainingUses', CASE
        WHEN _p.max_redemptions IS NULL THEN NULL
        ELSE greatest(_p.max_redemptions - _p.redemption_count, 0)
      END
    );
  END IF;

  IF _base_credits <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_credits');
  END IF;

  _bonus_credits := greatest(1, ceiling(_base_credits * _percent / 100.0)::integer);

  RETURN jsonb_build_object(
    'valid', true,
    'promoType', 'purchase_bonus',
    'code', _p.code,
    'bonusPercent', _percent,
    'baseCredits', _base_credits,
    'bonusCredits', _bonus_credits,
    'totalCredits', _base_credits + _bonus_credits,
    'originalAmount', _original,
    'finalAmount', _original,
    'expiresAt', _p.expires_at,
    'remainingUses', CASE
      WHEN _p.max_redemptions IS NULL THEN NULL
      ELSE greatest(_p.max_redemptions - _p.redemption_count, 0)
    END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.validate_purchase_discount(text, numeric, text);
GRANT EXECUTE ON FUNCTION public.validate_purchase_discount(text, numeric, text, integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.validate_purchase_discount(text, numeric, text, integer) FROM anon, public;

CREATE OR REPLACE FUNCTION public.submit_payment_request(
  _pack_id text,
  _credits integer,
  _amount numeric,
  _paypal_transaction_id text,
  _paypal_note text DEFAULT NULL,
  _discount_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _tx text := upper(trim(coalesce(_paypal_transaction_id, '')));
  _pack text := left(coalesce(nullif(trim(_pack_id), ''), 'custom'), 80);
  _original numeric := round(greatest(coalesce(_amount, 0), 0), 2);
  _final numeric := _original;
  _promo_code_clean text := upper(trim(coalesce(_discount_code, '')));
  _promo_type text;
  _discount_percent integer;
  _bonus_percent integer;
  _bonus_credits integer := 0;
  _promo public.promo_codes;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(_tx) < 6 OR length(_tx) > 80 THEN RAISE EXCEPTION 'invalid_transaction_id'; END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 20000 THEN RAISE EXCEPTION 'invalid_credits'; END IF;
  IF _original IS NULL OR _original < 0.50 OR _original > 2000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.payment_requests
    WHERE lower(paypal_transaction_id) = lower(_tx)
      AND status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'transaction_id_already_submitted';
  END IF;

  IF _promo_code_clean <> '' THEN
    SELECT *
      INTO _promo
      FROM public.promo_codes
     WHERE lower(code) = lower(_promo_code_clean)
       AND promo_type IN ('purchase_discount', 'purchase_bonus')
     FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'promo_code_not_found'; END IF;
    IF NOT _promo.active THEN RAISE EXCEPTION 'promo_code_disabled'; END IF;
    IF _promo.expires_at IS NOT NULL AND _promo.expires_at < now() THEN RAISE EXCEPTION 'promo_code_expired'; END IF;
    IF _promo.max_redemptions IS NOT NULL AND _promo.redemption_count >= _promo.max_redemptions THEN RAISE EXCEPTION 'promo_code_used_up'; END IF;
    IF _original < coalesce(_promo.minimum_amount, 0) THEN RAISE EXCEPTION 'promo_minimum_not_met'; END IF;
    IF _promo.applies_to <> 'all'
       AND _promo.applies_to <> lower(_pack)
       AND _promo.applies_to <> ('pack:' || lower(_pack))
       AND NOT (_promo.applies_to = 'custom' AND lower(_pack) LIKE 'custom%') THEN
      RAISE EXCEPTION 'promo_not_for_pack';
    END IF;

    _promo_type := _promo.promo_type;

    IF _promo_type = 'purchase_discount' THEN
      _discount_percent := least(greatest(coalesce(_promo.discount_percent, 0), 1), 95);
      _final := round(greatest(_original - round(_original * _discount_percent / 100.0, 2), 0.50), 2);
    ELSE
      _bonus_percent := least(greatest(coalesce(_promo.discount_percent, 0), 1), 95);
      _bonus_credits := greatest(1, ceiling(_credits * _bonus_percent / 100.0)::integer);
    END IF;

    UPDATE public.promo_codes
       SET redemption_count = redemption_count + 1
     WHERE id = _promo.id;
  END IF;

  INSERT INTO public.payment_requests (
    user_id,
    pack_id,
    credits,
    amount,
    original_amount,
    discounted_amount,
    discount_code,
    discount_percent,
    promo_type,
    bonus_percent,
    bonus_credits,
    paypal_transaction_id,
    paypal_note,
    status
  )
  VALUES (
    _uid,
    _pack,
    _credits + _bonus_credits,
    _final,
    CASE WHEN _promo_type = 'purchase_discount' THEN _original ELSE NULL END,
    CASE WHEN _promo_type = 'purchase_discount' THEN _final ELSE NULL END,
    NULLIF(_promo_code_clean, ''),
    _discount_percent,
    _promo_type,
    _bonus_percent,
    _bonus_credits,
    _tx,
    nullif(left(trim(coalesce(_paypal_note, '')), 500), ''),
    'pending'
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_approve_payment(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pr public.payment_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'only owners can approve credit payments';
  END IF;

  SELECT * INTO _pr
  FROM public.payment_requests
  WHERE id = _request_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'request not found or already processed'; END IF;

  PERFORM public.grant_credits_service(
    _pr.user_id,
    _pr.credits,
    CASE
      WHEN coalesce(_pr.bonus_credits, 0) > 0 THEN 'PayPal ' || _pr.pack_id || ' approved + launch bonus'
      ELSE 'PayPal ' || _pr.pack_id || ' approved'
    END
  );

  UPDATE public.payment_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.promo_codes;
  _new int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _p
  FROM public.promo_codes
  WHERE lower(code) = lower(trim(_code))
    AND promo_type = 'credits'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF NOT _p.active THEN RAISE EXCEPTION 'code_disabled'; END IF;
  IF _p.expires_at IS NOT NULL AND _p.expires_at < now() THEN RAISE EXCEPTION 'code_expired'; END IF;
  IF _p.max_redemptions IS NOT NULL AND _p.redemption_count >= _p.max_redemptions THEN RAISE EXCEPTION 'code_used_up'; END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE promo_id = _p.id AND user_id = _uid) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  INSERT INTO public.promo_redemptions(promo_id, user_id, credits) VALUES (_p.id, _uid, _p.credits);
  UPDATE public.promo_codes SET redemption_count = redemption_count + 1 WHERE id = _p.id;
  UPDATE public.profiles SET credits = credits + _p.credits, updated_at = now() WHERE id = _uid RETURNING credits INTO _new;
  INSERT INTO public.credit_transactions(user_id, amount, balance, reason) VALUES (_uid, _p.credits, _new, 'promo:' || _p.code);
  RETURN _new;
END;
$$;

INSERT INTO public.promo_codes (
  code,
  promo_type,
  credits,
  discount_percent,
  minimum_amount,
  applies_to,
  max_redemptions,
  expires_at,
  active
)
VALUES (
  'LAUNCH10',
  'purchase_bonus',
  1,
  10,
  0,
  'all',
  NULL,
  '2026-06-11 03:59:59+00'::timestamptz,
  true
)
ON CONFLICT (code) DO UPDATE
SET promo_type = EXCLUDED.promo_type,
    discount_percent = EXCLUDED.discount_percent,
    minimum_amount = EXCLUDED.minimum_amount,
    applies_to = EXCLUDED.applies_to,
    max_redemptions = EXCLUDED.max_redemptions,
    expires_at = EXCLUDED.expires_at,
    active = EXCLUDED.active;

