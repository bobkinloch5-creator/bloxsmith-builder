ALTER TABLE public.model_generations_3d
  ADD COLUMN IF NOT EXISTS generation_type text NOT NULL DEFAULT 'model',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS studio_file_path text,
  ADD COLUMN IF NOT EXISTS cooldown_unlock_at timestamptz;

UPDATE public.model_generations_3d
SET cooldown_unlock_at = COALESCE(cooldown_unlock_at, created_at + interval '7 days')
WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_model_gen_3d_user_cooldown
  ON public.model_generations_3d (user_id, cooldown_unlock_at DESC)
  WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_payment_requests_tx_lookup
  ON public.payment_requests (lower(paypal_transaction_id));

CREATE OR REPLACE FUNCTION public.submit_payment_request(
  _pack_id text,
  _credits integer,
  _amount numeric,
  _paypal_transaction_id text,
  _paypal_note text DEFAULT NULL
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(_tx) < 6 OR length(_tx) > 80 THEN RAISE EXCEPTION 'invalid_transaction_id'; END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 20000 THEN RAISE EXCEPTION 'invalid_credits'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 2000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.payment_requests
    WHERE lower(paypal_transaction_id) = lower(_tx)
      AND status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'transaction_id_already_submitted';
  END IF;

  INSERT INTO public.payment_requests (
    user_id,
    pack_id,
    credits,
    amount,
    paypal_transaction_id,
    paypal_note,
    status
  )
  VALUES (
    _uid,
    left(coalesce(nullif(trim(_pack_id), ''), 'custom'), 80),
    _credits,
    _amount,
    _tx,
    nullif(left(trim(coalesce(_paypal_note, '')), 500), ''),
    'pending'
  )
  RETURNING id INTO _id;

  RETURN _id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_payment_request(text, integer, numeric, text, text) TO authenticated, service_role;
