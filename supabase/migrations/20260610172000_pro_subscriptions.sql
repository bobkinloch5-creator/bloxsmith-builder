-- BloxSmith Pro subscription support. Pro is a subscription entitlement, not
-- an app role, so staff/moderator powers stay separate from paid model access.

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id text NOT NULL DEFAULT 'pro_monthly',
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'canceled', 'expired', 'past_due')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active
  ON public.user_subscriptions (user_id, status, current_period_end);

CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'pro_monthly',
  amount numeric(10,2) NOT NULL DEFAULT 25.00,
  currency text NOT NULL DEFAULT 'USD',
  crypto_currency text NOT NULL DEFAULT 'LTC',
  payment_reference text NOT NULL,
  payment_note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_requests_reference
  ON public.subscription_requests (lower(payment_reference));

CREATE INDEX IF NOT EXISTS idx_subscription_requests_pending
  ON public.subscription_requests (status, created_at DESC);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "platform admins read all subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "platform admins update subscriptions" ON public.user_subscriptions;

CREATE POLICY "users read own subscriptions"
ON public.user_subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "platform admins read all subscriptions"
ON public.user_subscriptions
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins update subscriptions"
ON public.user_subscriptions
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "users read own subscription requests" ON public.subscription_requests;
DROP POLICY IF EXISTS "users insert own subscription requests" ON public.subscription_requests;
DROP POLICY IF EXISTS "platform admins read all subscription requests" ON public.subscription_requests;
DROP POLICY IF EXISTS "platform admins update subscription requests" ON public.subscription_requests;

CREATE POLICY "users read own subscription requests"
ON public.subscription_requests
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own subscription requests"
ON public.subscription_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "platform admins read all subscription requests"
ON public.subscription_requests
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform admins update subscription requests"
ON public.subscription_requests
FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.subscription_requests TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
GRANT ALL ON public.subscription_requests TO service_role;

CREATE OR REPLACE FUNCTION public.is_pro_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'owner')
    OR EXISTS (
      SELECT 1
      FROM public.user_subscriptions s
      WHERE s.user_id = _user_id
        AND s.plan_id = 'pro_monthly'
        AND s.status IN ('active', 'canceled')
        AND s.current_period_end > now()
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_pro_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_pro_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_subscription_request(
  _plan_id text,
  _amount numeric,
  _payment_reference text,
  _payment_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id uuid;
  _ref text := trim(coalesce(_payment_reference, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _plan_id <> 'pro_monthly' THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  IF _amount <> 25.00 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF length(_ref) < 6 THEN
    RAISE EXCEPTION 'invalid_payment_reference';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.subscription_requests
    WHERE lower(payment_reference) = lower(_ref)
  ) THEN
    RAISE EXCEPTION 'payment_reference_already_submitted';
  END IF;

  INSERT INTO public.subscription_requests (
    user_id, plan_id, amount, payment_reference, payment_note
  )
  VALUES (auth.uid(), _plan_id, _amount, _ref, NULLIF(trim(coalesce(_payment_note, '')), ''))
  RETURNING id INTO _request_id;

  RETURN _request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_subscription_request(text, numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_subscription_request(text, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_subscription(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.subscription_requests;
  _period_start timestamptz := now();
  _period_base timestamptz;
  _period_end timestamptz;
  _current_credits integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _req
  FROM public.subscription_requests
  WHERE id = _request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  SELECT greatest(coalesce(current_period_end, now()), now())
  INTO _period_base
  FROM public.user_subscriptions
  WHERE user_id = _req.user_id
  FOR UPDATE;

  _period_end := coalesce(_period_base, now()) + interval '1 month';

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, updated_at
  )
  VALUES (
    _req.user_id, _req.plan_id, 'active', _period_start, _period_end,
    false, NULL, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = excluded.plan_id,
    status = 'active',
    current_period_start = _period_start,
    current_period_end = _period_end,
    cancel_at_period_end = false,
    canceled_at = NULL,
    updated_at = now();

  UPDATE public.subscription_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _request_id;

  SELECT COALESCE(credits, 0) INTO _current_credits
  FROM public.profiles
  WHERE id = _req.user_id OR user_id = _req.user_id
  LIMIT 1;

  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + 500, updated_at = now()
  WHERE id = _req.user_id OR user_id = _req.user_id;

  INSERT INTO public.credit_transactions (user_id, amount, tx_type, description, metadata)
  VALUES (
    _req.user_id,
    500,
    'grant',
    'BloxSmith Pro monthly bonus credits',
    jsonb_build_object('subscription_request_id', _request_id, 'balance_before', COALESCE(_current_credits, 0))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_subscription(_request_id uuid, _reason text DEFAULT 'Payment could not be verified')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.subscription_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reject_reason = NULLIF(trim(coalesce(_reason, '')), ''),
      updated_at = now()
  WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.user_subscriptions
  SET status = 'canceled',
      cancel_at_period_end = true,
      canceled_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND plan_id = 'pro_monthly'
    AND status = 'active'
    AND current_period_end > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_subscription';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_subscription(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_reject_subscription(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_my_subscription() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_approve_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_my_subscription() TO authenticated;
