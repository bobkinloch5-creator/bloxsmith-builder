-- Profile customization & presence: extend profiles with Discord-style fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_background text,
  ADD COLUMN IF NOT EXISTS profile_layout text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS pfp_effect text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS status_message text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS presence_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_status text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_activity jsonb;

-- Validation constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profile_background_valid') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_background_valid
      CHECK (profile_background IS NULL OR profile_background = ANY (ARRAY[
        'none','studio','neon-city','obby','forest','space','lava','clouds','void','sunset','ocean','candy','matrix'
      ]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profile_layout_valid') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_layout_valid
      CHECK (profile_layout = ANY (ARRAY['classic','card','cinematic','compact']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pfp_effect_valid') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pfp_effect_valid
      CHECK (pfp_effect = ANY (ARRAY['none','gold','rainbow','flame','electric','ice','galaxy','rose']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_presence_status_valid') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_presence_status_valid
      CHECK (presence_status = ANY (ARRAY['online','idle','dnd','invisible']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_message_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_message_len
      CHECK (status_message IS NULL OR char_length(status_message) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pronouns_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_len
      CHECK (pronouns IS NULL OR char_length(pronouns) <= 32);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_location_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_location_len
      CHECK (location IS NULL OR char_length(location) <= 64);
  END IF;
END $$;

-- Index for presence queries (online friends, etc.)
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen_at DESC) WHERE presence_enabled = true;

-- Heartbeat RPC (called every minute by signed-in clients)
CREATE OR REPLACE FUNCTION public.update_presence(_status text DEFAULT NULL, _activity jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles
     SET last_seen_at = now(),
         presence_status = COALESCE(NULLIF(_status, ''), presence_status),
         current_activity = CASE WHEN _activity IS NULL THEN current_activity ELSE _activity END,
         updated_at = now()
   WHERE id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_presence(text, jsonb) TO authenticated;
