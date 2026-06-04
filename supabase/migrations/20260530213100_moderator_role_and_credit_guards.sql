-- Moderators can handle Global Chat moderation only.
-- Owners remain the only people who can grant roles or manually adjust credits.

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'moderator')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_moderator(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profile_credits_for_policy(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT credits FROM public.profiles WHERE id = _user_id $$;

REVOKE EXECUTE ON FUNCTION public.profile_credits_for_policy(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.profile_credits_for_policy(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profile_ban_state_for_policy(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'banned', banned,
    'ban_reason', ban_reason,
    'banned_at', banned_at
  )
  FROM public.profiles
  WHERE id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.profile_ban_state_for_policy(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.profile_ban_state_for_policy(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own safe profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND credits = public.profile_credits_for_policy(id)
  AND jsonb_build_object(
    'banned', banned,
    'ban_reason', ban_reason,
    'banned_at', banned_at
  ) = public.profile_ban_state_for_policy(id)
);

DROP POLICY IF EXISTS "reports view own or admin" ON public.global_chat_reports;
DROP POLICY IF EXISTS "reports update admin" ON public.global_chat_reports;
CREATE POLICY "reports view own or moderator"
ON public.global_chat_reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id OR public.is_moderator(auth.uid()));

CREATE POLICY "reports update moderator"
ON public.global_chat_reports
FOR UPDATE
TO authenticated
USING (public.is_moderator(auth.uid()))
WITH CHECK (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "audit admin read" ON public.global_chat_audit;
CREATE POLICY "audit moderator read"
ON public.global_chat_audit
FOR SELECT
TO authenticated
USING (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "admins manage promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "owners manage promo codes" ON public.promo_codes;
CREATE POLICY "owners manage promo codes"
ON public.promo_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'only owners can manage roles';
  END IF;

  IF _role = 'owner' THEN
    RAISE EXCEPTION 'owner role cannot be changed here';
  END IF;

  IF _role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'role cannot be changed here';
  END IF;

  IF public.has_role(_user_id, 'owner') AND NOT _grant THEN
    RAISE EXCEPTION 'cannot demote owner';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role;
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.spend_credits_atomic(_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new int;
  _is_owner boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 10000 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;

  SELECT public.has_role(_uid, 'owner') INTO _is_owner;
  IF _is_owner THEN RETURN 999999; END IF;

  UPDATE public.profiles
  SET credits = credits - _amount, updated_at = now()
  WHERE id = _uid
    AND credits >= _amount
  RETURNING credits INTO _new;

  IF _new IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (_uid, -_amount, _new, 'ai_spend');

  RETURN _new;
END
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer, _reason text DEFAULT 'refund')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new int;
  _clean_reason text := left(coalesce(nullif(trim(_reason), ''), 'refund'), 120);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 10000 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;
  IF public.has_role(_uid, 'owner') THEN RETURN 999999; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions spent
    WHERE spent.user_id = _uid
      AND spent.amount = -_amount
      AND spent.created_at > now() - interval '2 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.credit_transactions refunded
        WHERE refunded.user_id = _uid
          AND refunded.amount = _amount
          AND refunded.created_at >= spent.created_at
          AND refunded.reason LIKE 'refund:%'
      )
  ) THEN
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

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'only owners can adjust credits';
  END IF;
  IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 100000 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;
  IF auth.uid() = _user_id AND _amount > 0 THEN
    RAISE EXCEPTION 'owners already have unlimited credits';
  END IF;

  UPDATE public.profiles
  SET credits = GREATEST(0, credits + _amount), updated_at = now()
  WHERE id = _user_id
  RETURNING credits INTO _new;

  IF _new IS NULL THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (_user_id, _amount, _new, left(coalesce(nullif(trim(_reason), ''), 'owner adjust'), 120));

  RETURN _new;
END
$$;

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

  PERFORM public.grant_credits_service(_pr.user_id, _pr.credits, 'PayPal ' || _pr.pack_id || ' approved');
  UPDATE public.payment_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_promotion(_submission_id uuid, _credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.promotion_submissions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'only owners can approve credit rewards';
  END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 500 THEN
    RAISE EXCEPTION 'invalid_credits';
  END IF;

  SELECT * INTO _s
  FROM public.promotion_submissions
  WHERE id = _submission_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'submission not found or already processed'; END IF;

  PERFORM public.grant_credits_service(_s.user_id, _credits, 'promotion_reward');
  UPDATE public.promotion_submissions
  SET status = 'approved',
      credits_awarded = _credits,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _submission_id;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_delete_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.global_chat_messages
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = _message_id
    AND deleted_at IS NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_mute(_user_id uuid, _minutes int, _reason text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _until timestamptz;
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.has_role(_user_id, 'owner') THEN RAISE EXCEPTION 'cannot_mute_owner'; END IF;
  IF public.has_role(_user_id, 'admin') AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'cannot_mute_admin';
  END IF;
  _until := CASE
    WHEN _minutes IS NULL OR _minutes <= 0 THEN now() + interval '100 years'
    ELSE now() + make_interval(mins => _minutes)
  END;
  INSERT INTO public.global_chat_mutes(user_id, muted_until, reason, created_by)
  VALUES (_user_id, _until, left(coalesce(_reason, 'Moderator mute'), 200), auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET
    muted_until = EXCLUDED.muted_until,
    reason = EXCLUDED.reason,
    created_by = EXCLUDED.created_by,
    created_at = now();
  RETURN _until;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_unmute(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.global_chat_mutes WHERE user_id = _user_id;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_pin_message(_message_id uuid, _pin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _pin THEN
    UPDATE public.global_chat_messages SET pinned_at = now(), pinned_by = auth.uid() WHERE id = _message_id;
  ELSE
    UPDATE public.global_chat_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = _message_id;
  END IF;
  INSERT INTO public.global_chat_audit (actor_id, action, target_message_id, details)
  VALUES (auth.uid(), CASE WHEN _pin THEN 'pin' ELSE 'unpin' END, _message_id, NULL);
END
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_warn(_user_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT public.is_moderator(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF public.has_role(_user_id, 'owner') THEN RAISE EXCEPTION 'cannot_warn_owner'; END IF;
  INSERT INTO public.global_chat_warnings (user_id, issued_by, reason)
  VALUES (_user_id, auth.uid(), left(coalesce(_reason, 'Warning'), 200))
  RETURNING id INTO _id;
  INSERT INTO public.global_chat_audit (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), 'warn', _user_id, jsonb_build_object('reason', left(coalesce(_reason, 'Warning'), 200)));
  RETURN _id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.admin_chat_delete_message(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_chat_mute(uuid, int, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_chat_unmute(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_chat_pin_message(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_chat_warn(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_chat_delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_chat_mute(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_chat_unmute(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_chat_pin_message(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_chat_warn(uuid, text) TO authenticated;
