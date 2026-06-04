-- 1) Profiles: revoke direct SELECT on sensitive columns from authenticated/anon
--    RLS still gates rows; column-level GRANT prevents leaking these fields to other users.
REVOKE SELECT (email, credits, ban_reason, banned_at, referred_by, referral_code, onboarding_reward_claimed, hide_email)
  ON public.profiles FROM authenticated, anon;

-- Re-grant SELECT on all the remaining (safe) columns to authenticated.
GRANT SELECT
  (id, user_id, username, display_name, avatar_url, bio, banned, created_at, updated_at,
   username_normalized, banner_url, specialization, discord_claimed,
   chat_name_gradient, chat_text_gradient, chat_icon, chat_nickname, chat_font,
   profile_accent, profile_card_color, profile_card_effect, profile_effect,
   profile_background, custom_background_url, profile_layout, pfp_effect,
   status_message, pronouns, location, private_profile,
   presence_enabled, presence_status, show_activity, last_seen_at, current_activity,
   profile_badges, profile_decoration, onboarding_completed_at, onboarding_step, theme)
  ON public.profiles TO authenticated;

-- Service role keeps full access for server-side operations.
GRANT ALL ON public.profiles TO service_role;

-- 2) roblox_docs_sync: restrict SELECT to admins only.
DROP POLICY IF EXISTS "All authenticated can read roblox_docs_sync" ON public.roblox_docs_sync;
DROP POLICY IF EXISTS "Authenticated read roblox_docs_sync" ON public.roblox_docs_sync;
DROP POLICY IF EXISTS "roblox_docs_sync select" ON public.roblox_docs_sync;
DROP POLICY IF EXISTS "Anyone authenticated can read sync log" ON public.roblox_docs_sync;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.roblox_docs_sync'::regclass AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.roblox_docs_sync', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Admins read roblox_docs_sync"
  ON public.roblox_docs_sync
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
