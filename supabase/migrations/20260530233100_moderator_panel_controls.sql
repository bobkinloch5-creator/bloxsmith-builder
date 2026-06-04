CREATE TABLE IF NOT EXISTS public.moderator_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  amount integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderator_actions_actor_day
  ON public.moderator_actions(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderator_actions_target
  ON public.moderator_actions(target_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.moderator_actions TO authenticated;
GRANT ALL ON public.moderator_actions TO service_role;

ALTER TABLE public.moderator_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderator actions read own or admin" ON public.moderator_actions;
CREATE POLICY "moderator actions read own or admin"
ON public.moderator_actions
FOR SELECT
TO authenticated
USING (
  actor_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "moderator actions insert moderator" ON public.moderator_actions;
CREATE POLICY "moderator actions insert moderator"
ON public.moderator_actions
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND public.is_moderator(auth.uid())
);

CREATE OR REPLACE FUNCTION public.moderator_gift_credits(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _today_total integer;
  _new integer;
  _clean_reason text := left(coalesce(nullif(trim(_reason), ''), 'moderator help credit'), 120);
BEGIN
  IF _actor IS NULL OR NOT public.is_moderator(_actor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 25 THEN
    RAISE EXCEPTION 'moderator_credit_limit';
  END IF;
  IF public.has_role(_user_id, 'owner') OR public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'cannot_gift_privileged_user';
  END IF;

  SELECT COALESCE(sum(amount), 0)
  INTO _today_total
  FROM public.moderator_actions
  WHERE actor_id = _actor
    AND action = 'gift_credits'
    AND created_at >= date_trunc('day', now());

  IF _today_total + _amount > 100 THEN
    RAISE EXCEPTION 'moderator_daily_credit_limit';
  END IF;

  UPDATE public.profiles
  SET credits = credits + _amount, updated_at = now()
  WHERE id = _user_id
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (_user_id, _amount, _new, 'moderator:' || _clean_reason);

  INSERT INTO public.moderator_actions(actor_id, target_user_id, action, amount, metadata)
  VALUES (_actor, _user_id, 'gift_credits', _amount, jsonb_build_object('reason', _clean_reason));

  RETURN _new;
END
$$;

REVOKE EXECUTE ON FUNCTION public.moderator_gift_credits(uuid, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.moderator_gift_credits(uuid, integer, text) TO authenticated, service_role;
