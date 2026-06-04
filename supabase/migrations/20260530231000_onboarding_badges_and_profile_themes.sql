ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reward_claimed boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_background_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_background_valid
  CHECK (
    profile_background IS NULL
    OR profile_background = ANY (ARRAY[
      'none','custom','studio','neon-city','obby','forest','space','lava','clouds','void','sunset','ocean','candy','matrix',
      'futuristic','simulator','tycoon','anime','fantasy','city','neon','dark','premium'
    ])
  );

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_badges_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_badges_valid CHECK (
  array_length(profile_badges, 1) IS NULL OR (
    array_length(profile_badges, 1) <= 12 AND
    array_to_string(profile_badges, ',') ~ '^[a-z0-9_-]+(,[a-z0-9_-]+)*$'
  )
);

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
         profile_badges = (
           SELECT ARRAY(
             SELECT DISTINCT badge
               FROM unnest(COALESCE(profile_badges, '{}'::text[]) || ARRAY['onboarding']::text[]) AS badge
              WHERE badge IS NOT NULL AND badge <> ''
              LIMIT 12
           )
         ),
         updated_at = now()
   WHERE id = _uid;

  IF NOT COALESCE(_already, false) AND COALESCE(_reward, 0) > 0 THEN
    PERFORM public.grant_credits_service(_uid, COALESCE(_reward, 10), 'onboarding_complete');
    _credits_awarded := COALESCE(_reward, 10);
  END IF;

  RETURN jsonb_build_object('completed', true, 'credits_awarded', _credits_awarded);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(integer, integer) TO authenticated;
