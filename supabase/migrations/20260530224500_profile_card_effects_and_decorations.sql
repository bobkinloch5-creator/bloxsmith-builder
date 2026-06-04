-- Profile card color/effect customization and expanded decoration support.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_card_color text NOT NULL DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS profile_card_effect text NOT NULL DEFAULT 'soft_glow';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_card_color_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_card_color_valid
  CHECK (profile_card_color ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_card_effect_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_card_effect_valid
  CHECK (profile_card_effect ~ '^[a-z0-9_-]{1,32}$');
