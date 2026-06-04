ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_background_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_background_valid
  CHECK (
    profile_background IS NULL
    OR profile_background = ANY (ARRAY[
      'none','custom','studio','neon-city','obby','forest','space','lava','clouds','void','sunset','ocean','candy','matrix'
    ])
  );