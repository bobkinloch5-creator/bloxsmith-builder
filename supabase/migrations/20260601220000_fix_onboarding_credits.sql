-- ============================================================================
-- FIX: onboarding completion not granting credits
--
-- Ensures the onboarding_reward_claimed column and the complete_onboarding()
-- RPC exist. If the original migration was never applied to this database,
-- the app's RPC call fails and users finish onboarding with no credits.
-- Idempotent — safe to run once in the Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reward_claimed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.complete_onboarding(_step integer DEFAULT 11, _reward integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _already boolean;
  _credits_awarded integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT onboarding_reward_claimed
    INTO _already
    FROM public.profiles
   WHERE id = _uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
     SET onboarding_step = GREATEST(0, LEAST(COALESCE(_step, 11), 20)),
          onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
          onboarding_reward_claimed = true,
          updated_at = now()
   WHERE id = _uid;

  -- Grant the reward only the first time (guarantees "once").
  IF NOT COALESCE(_already, false) AND COALESCE(_reward, 0) > 0 THEN
    PERFORM public.grant_credits_service(_uid, COALESCE(_reward, 10), 'onboarding_complete');
    _credits_awarded := COALESCE(_reward, 10);
  END IF;

  RETURN jsonb_build_object('completed', true, 'credits_awarded', _credits_awarded);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(integer, integer) TO authenticated;
