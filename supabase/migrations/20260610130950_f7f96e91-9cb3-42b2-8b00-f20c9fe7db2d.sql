-- ============================================================
-- Security fix: lock down profile-media storage and profiles table
-- ============================================================

-- 1) Remove the overly permissive SELECT policy on profile-media bucket
DROP POLICY IF EXISTS "profile media readable by authenticated" ON storage.objects;

-- The remaining owner-scoped read policy still applies. Cross-user images
-- (avatars, banners, custom backgrounds) are intended to be publicly
-- viewable, so the bucket is flipped to public separately via the storage
-- bucket tool. Owner-only objects continue to require auth-scoped access.

-- 2) Lock down the profiles table
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

-- Owner: full row access to self (covers sensitive columns through RLS).
CREATE POLICY "Profiles owner full read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR auth.uid() = user_id);

-- Public column read for everyone else. Combined with the column-level
-- GRANTs below, non-owners can only read the safe (public) columns.
CREATE POLICY "Profiles public columns read" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Revoke broad table-level SELECT and re-grant SELECT only on safe columns.
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, username, username_normalized, display_name, avatar_url,
  banner_url, bio, specialization, banned, discord_claimed,
  chat_name_gradient, chat_text_gradient, chat_icon, chat_nickname, chat_font,
  profile_accent, profile_card_color, profile_card_effect, profile_effect,
  profile_background, custom_background_url, profile_layout, pfp_effect,
  status_message, pronouns, location, private_profile, presence_enabled,
  presence_status, show_activity, last_seen_at, current_activity,
  profile_badges, profile_decoration, theme, favorite_game_types,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- Service role and the schema owner keep full access for trusted code.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- 3) Owner-only RPCs that expose sensitive columns through a SECURITY
--    DEFINER boundary so the browser client can still read its own
--    sensitive fields.

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT * INTO _row FROM public.profiles WHERE id = _uid OR user_id = _uid LIMIT 1;
  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.count_my_referrals()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT COUNT(*) INTO _n FROM public.profiles WHERE referred_by = _uid;
  RETURN COALESCE(_n, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_my_referrals() TO authenticated;
