
-- 1) Ensure sensitive columns on profiles are not readable by anon/authenticated
DO $$
DECLARE
  col text;
  sensitive_cols text[] := ARRAY[
    'email','credits','referral_code','referred_by',
    'hide_email','onboarding_reward_claimed','ban_reason','banned_at'
  ];
BEGIN
  FOREACH col IN ARRAY sensitive_cols LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon', col);
    EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM authenticated', col);
  END LOOP;
END$$;

-- 2) Drop overly broad profile-media SELECT policy; keep owner-scoped policy only
DROP POLICY IF EXISTS "Profile media readable by authenticated" ON storage.objects;
