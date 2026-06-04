ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'credits',
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS minimum_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all';

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS discounted_amount numeric;

CREATE OR REPLACE FUNCTION public.validate_purchase_discount(
  _code text,
  _amount numeric,
  _pack_id text DEFAULT 'custom'
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
  _discount numeric;
  _final numeric;
BEGIN
  IF _clean = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty_code');
  END IF;

  SELECT *
    INTO _p
    FROM public.promo_codes
   WHERE lower(code) = lower(_clean)
     AND promo_type = 'purchase_discount'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'code_not_found');
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
  IF coalesce(_p.discount_percent, 0) <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_a_discount');
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

  _discount := round(_original * least(greatest(_p.discount_percent, 1), 95) / 100.0, 2);
  _final := round(greatest(_original - _discount, 0.50), 2);

  RETURN jsonb_build_object(
    'valid', true,
    'code', _p.code,
    'discountPercent', least(greatest(_p.discount_percent, 1), 95),
    'discountAmount', _discount,
    'originalAmount', _original,
    'finalAmount', _final,
    'expiresAt', _p.expires_at,
    'remainingUses', CASE
      WHEN _p.max_redemptions IS NULL THEN NULL
      ELSE greatest(_p.max_redemptions - _p.redemption_count, 0)
    END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_payment_request(text, integer, numeric, text, text);

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
  _discount_code_clean text := upper(trim(coalesce(_discount_code, '')));
  _discount_percent integer;
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

  IF _discount_code_clean <> '' THEN
    SELECT *
      INTO _promo
      FROM public.promo_codes
     WHERE lower(code) = lower(_discount_code_clean)
       AND promo_type = 'purchase_discount'
     FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'discount_code_not_found'; END IF;
    IF NOT _promo.active THEN RAISE EXCEPTION 'discount_code_disabled'; END IF;
    IF _promo.expires_at IS NOT NULL AND _promo.expires_at < now() THEN RAISE EXCEPTION 'discount_code_expired'; END IF;
    IF _promo.max_redemptions IS NOT NULL AND _promo.redemption_count >= _promo.max_redemptions THEN RAISE EXCEPTION 'discount_code_used_up'; END IF;
    IF _original < coalesce(_promo.minimum_amount, 0) THEN RAISE EXCEPTION 'discount_minimum_not_met'; END IF;
    IF _promo.applies_to <> 'all'
       AND _promo.applies_to <> lower(_pack)
       AND _promo.applies_to <> ('pack:' || lower(_pack))
       AND NOT (_promo.applies_to = 'custom' AND lower(_pack) LIKE 'custom%') THEN
      RAISE EXCEPTION 'discount_not_for_pack';
    END IF;

    _discount_percent := least(greatest(coalesce(_promo.discount_percent, 0), 1), 95);
    _final := round(greatest(_original - round(_original * _discount_percent / 100.0, 2), 0.50), 2);
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
    paypal_transaction_id,
    paypal_note,
    status
  )
  VALUES (
    _uid,
    _pack,
    _credits,
    _final,
    CASE WHEN _discount_code_clean = '' THEN NULL ELSE _original END,
    CASE WHEN _discount_code_clean = '' THEN NULL ELSE _final END,
    NULLIF(_discount_code_clean, ''),
    _discount_percent,
    _tx,
    nullif(left(trim(coalesce(_paypal_note, '')), 500), ''),
    'pending'
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_purchase_discount(text, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.validate_purchase_discount(text, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text, text) TO authenticated, service_role;
