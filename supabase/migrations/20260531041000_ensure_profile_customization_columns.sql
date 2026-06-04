-- Safety net: guarantee every profile-customization column the app writes
-- actually exists in the live database.
--
-- Symptom this addresses: "profiles don't save." updateProfileCustomization
-- builds a patch from the fields the UI sends and runs a single
-- UPDATE public.profiles SET <patch>. If even one of those columns is missing
-- from the live schema (e.g. an earlier column migration was never applied to
-- production), Postgres rejects the ENTIRE update with
-- 'column "..." does not exist', so nothing the user changed is saved and they
-- see a generic save error.
--
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS), so this is a no-op
-- on databases that are already up to date and a repair everywhere else.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name          text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio                   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pronouns              text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location              text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_message        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_background_url  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_accent        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_card_color    text NOT NULL DEFAULT '#0f172a';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_card_effect   text NOT NULL DEFAULT 'soft_glow';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_effect        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_background    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_layout        text NOT NULL DEFAULT 'classic';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pfp_effect            text NOT NULL DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_decoration    text NOT NULL DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_badges        text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS private_profile       boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_email            boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS presence_enabled      boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS presence_status       text NOT NULL DEFAULT 'online';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_activity         boolean NOT NULL DEFAULT true;

-- Normalize any rows that pre-date the nullable columns so previews render.
UPDATE public.profiles SET profile_card_color  = COALESCE(profile_card_color, '#0f172a');
UPDATE public.profiles SET profile_card_effect = COALESCE(NULLIF(profile_card_effect, ''), 'soft_glow');
UPDATE public.profiles SET profile_layout      = COALESCE(NULLIF(profile_layout, ''), 'classic');
UPDATE public.profiles SET pfp_effect          = COALESCE(NULLIF(pfp_effect, ''), 'none');
UPDATE public.profiles SET profile_decoration  = COALESCE(NULLIF(profile_decoration, ''), 'none');
UPDATE public.profiles SET presence_status     = COALESCE(NULLIF(presence_status, ''), 'online');
