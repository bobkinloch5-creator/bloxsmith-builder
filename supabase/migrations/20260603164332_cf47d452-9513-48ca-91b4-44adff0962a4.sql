
-- 1. Remove profiles from realtime publication and re-add with a safe column list
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles (
  id,
  user_id,
  username,
  username_normalized,
  display_name,
  avatar_url,
  banner_url,
  bio,
  specialization,
  profile_badges,
  profile_decoration,
  profile_background,
  profile_effect,
  profile_card_effect,
  profile_card_color,
  profile_accent,
  profile_layout,
  custom_background_url,
  pfp_effect,
  chat_font,
  chat_nickname,
  chat_icon,
  chat_text_gradient,
  chat_name_gradient,
  status_message,
  pronouns,
  location,
  theme,
  presence_status,
  presence_enabled,
  show_activity,
  current_activity,
  last_seen_at,
  private_profile,
  banned,
  discord_claimed,
  created_at,
  updated_at
);

-- 2. Enable RLS on realtime.messages so subscriptions require auth
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can broadcast to realtime" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Make insert intent explicit on model_generations_3d
DROP POLICY IF EXISTS "users insert own 3d generations" ON public.model_generations_3d;
CREATE POLICY "users insert own 3d generations"
  ON public.model_generations_3d
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
