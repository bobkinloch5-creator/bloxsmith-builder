
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_accent text,
  ADD COLUMN IF NOT EXISTS profile_effect text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_accent_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_accent_valid
  CHECK (profile_accent IS NULL OR profile_accent ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_effect_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_effect_valid
  CHECK (profile_effect IS NULL OR profile_effect IN ('none','sparkle','aurora','neon','holographic','confetti','stars'));
