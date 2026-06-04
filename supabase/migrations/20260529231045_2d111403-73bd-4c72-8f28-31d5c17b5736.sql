
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id bigint,
  ADD COLUMN IF NOT EXISTS roblox_username text,
  ADD COLUMN IF NOT EXISTS roblox_display_name text,
  ADD COLUMN IF NOT EXISTS roblox_avatar_url text,
  ADD COLUMN IF NOT EXISTS roblox_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS roblox_verification_code text,
  ADD COLUMN IF NOT EXISTS roblox_verification_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_roblox_user_id_key
  ON public.profiles (roblox_user_id)
  WHERE roblox_user_id IS NOT NULL;
