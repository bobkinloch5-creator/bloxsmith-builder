-- Final profile-settings save repair.
-- Guarantees every field written by ProfileCustomizationCard, ChatStyleCard,
-- profile media upload, and profile previews exists with compatible defaults.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS username_normalized text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS hide_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_name_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_text_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_icon text,
  ADD COLUMN IF NOT EXISTS chat_nickname text,
  ADD COLUMN IF NOT EXISTS chat_font text,
  ADD COLUMN IF NOT EXISTS profile_accent text,
  ADD COLUMN IF NOT EXISTS profile_card_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS profile_card_effect text DEFAULT 'soft_glow',
  ADD COLUMN IF NOT EXISTS profile_effect text,
  ADD COLUMN IF NOT EXISTS profile_background text,
  ADD COLUMN IF NOT EXISTS custom_background_url text,
  ADD COLUMN IF NOT EXISTS profile_layout text DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS pfp_effect text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS status_message text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS private_profile boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS presence_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_status text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_decoration text DEFAULT 'none';

UPDATE public.profiles
   SET hide_email = COALESCE(hide_email, true),
       profile_card_color = COALESCE(NULLIF(profile_card_color, ''), '#0f172a'),
       profile_card_effect = COALESCE(NULLIF(profile_card_effect, ''), 'soft_glow'),
       profile_layout = COALESCE(NULLIF(profile_layout, ''), 'classic'),
       pfp_effect = COALESCE(NULLIF(pfp_effect, ''), 'none'),
       private_profile = COALESCE(private_profile, false),
       presence_enabled = COALESCE(presence_enabled, true),
       presence_status = COALESCE(NULLIF(presence_status, ''), 'online'),
       show_activity = COALESCE(show_activity, true),
       profile_badges = COALESCE(profile_badges, '{}'::text[]),
       profile_decoration = COALESCE(NULLIF(profile_decoration, ''), 'none');

ALTER TABLE public.profiles
  ALTER COLUMN hide_email SET DEFAULT true,
  ALTER COLUMN profile_card_color SET DEFAULT '#0f172a',
  ALTER COLUMN profile_card_effect SET DEFAULT 'soft_glow',
  ALTER COLUMN profile_layout SET DEFAULT 'classic',
  ALTER COLUMN pfp_effect SET DEFAULT 'none',
  ALTER COLUMN private_profile SET DEFAULT false,
  ALTER COLUMN presence_enabled SET DEFAULT true,
  ALTER COLUMN presence_status SET DEFAULT 'online',
  ALTER COLUMN show_activity SET DEFAULT true,
  ALTER COLUMN profile_badges SET DEFAULT '{}',
  ALTER COLUMN profile_decoration SET DEFAULT 'none';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_chat_name_gradient_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_chat_name_gradient_valid CHECK (
  chat_name_gradient IS NULL OR (
    array_length(chat_name_gradient, 1) BETWEEN 1 AND 4
    AND array_to_string(chat_name_gradient, ',') ~ '^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6}){0,3}$'
  )
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_chat_text_gradient_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_chat_text_gradient_valid CHECK (
  chat_text_gradient IS NULL OR (
    array_length(chat_text_gradient, 1) BETWEEN 1 AND 4
    AND array_to_string(chat_text_gradient, ',') ~ '^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6}){0,3}$'
  )
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_chat_icon_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_chat_icon_valid CHECK (
  chat_icon IS NULL OR chat_icon = ANY (ARRAY[
    'sparkles','star','crown','flame','heart','leaf','zap','moon','sun','rocket','gem','trophy',
    'music','gamepad','cake','coffee','sailboat','mountain','cloud','snowflake','paw','anchor'
  ])
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_chat_font_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_chat_font_valid CHECK (
  chat_font IS NULL OR chat_font = ANY (ARRAY[
    'sans','serif','mono','rounded','display','handwritten','futuristic','elegant'
  ])
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_chat_nickname_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_chat_nickname_valid CHECK (
  chat_nickname IS NULL OR (
    char_length(chat_nickname) <= 24
    AND chat_nickname ~ '^[A-Za-z0-9 _.\-]*$'
  )
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_accent_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_accent_valid
  CHECK (profile_accent IS NULL OR profile_accent ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_card_color_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_card_color_valid
  CHECK (profile_card_color ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_card_effect_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_card_effect_valid
  CHECK (profile_card_effect = ANY (ARRAY[
    'none','soft_glow','aurora_edge','premium_shine','scanline','starfield','pixel_rain'
  ]));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_effect_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_effect_valid CHECK (
  profile_effect IS NULL OR profile_effect = ANY (ARRAY[
    'none','sparkle','aurora','neon','holographic','confetti','stars','comet','runes','spotlight'
  ])
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_background_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_background_valid CHECK (
  profile_background IS NULL OR profile_background = ANY (ARRAY[
    'none','custom','studio','neon-city','obby','forest','space','lava','clouds','void','sunset','ocean',
    'candy','matrix','futuristic','simulator','tycoon','anime','fantasy','city','neon','dark','premium'
  ])
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_layout_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_layout_valid
  CHECK (profile_layout = ANY (ARRAY['classic','card','cinematic','compact']));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pfp_effect_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pfp_effect_valid
  CHECK (pfp_effect = ANY (ARRAY['none','gold','rainbow','flame','electric','ice','galaxy','rose']));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_presence_status_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_presence_status_valid
  CHECK (presence_status = ANY (ARRAY['online','idle','dnd','invisible']));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_message_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_message_len
  CHECK (status_message IS NULL OR char_length(status_message) <= 100);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pronouns_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_len
  CHECK (pronouns IS NULL OR char_length(pronouns) <= 32);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_location_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_location_len
  CHECK (location IS NULL OR char_length(location) <= 64);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_custom_background_url_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_custom_background_url_len
  CHECK (custom_background_url IS NULL OR char_length(custom_background_url) <= 1024);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_decoration_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_decoration_valid
  CHECK (profile_decoration ~ '^[a-z0-9_-]{1,32}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_badges_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_badges_valid CHECK (
  array_length(profile_badges, 1) IS NULL OR (
    array_length(profile_badges, 1) <= 12
    AND array_to_string(profile_badges, ',') ~ '^[a-z0-9_-]+(,[a-z0-9_-]+)*$'
  )
);

NOTIFY pgrst, 'reload schema';
