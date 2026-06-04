
-- Achievement catalog
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'Award',
  category text NOT NULL DEFAULT 'general',
  xp_reward integer NOT NULL DEFAULT 0,
  credit_reward integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "achievements admin manage" ON public.achievements FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- User unlocks
CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_key)
);
GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements readable" ON public.user_achievements FOR SELECT USING (true);

-- User levels / XP
CREATE TABLE public.user_levels (
  user_id uuid PRIMARY KEY,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  messages_sent integer NOT NULL DEFAULT 0,
  chat_credits_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_levels TO anon, authenticated;
GRANT ALL ON public.user_levels TO service_role;
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_levels readable" ON public.user_levels FOR SELECT USING (true);

-- Helper: unlock achievement (idempotent)
CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ach RECORD;
  _newly boolean := false;
BEGIN
  SELECT * INTO _ach FROM public.achievements WHERE key = _key;
  IF _ach.key IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_achievements (user_id, achievement_key)
  VALUES (_user_id, _key)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _newly = ROW_COUNT;

  IF _newly THEN
    IF _ach.credit_reward > 0 THEN
      UPDATE public.profiles SET credits = credits + _ach.credit_reward, updated_at = now()
        WHERE id = _user_id;
    END IF;
    IF _ach.xp_reward > 0 THEN
      INSERT INTO public.user_levels (user_id, xp) VALUES (_user_id, _ach.xp_reward)
      ON CONFLICT (user_id) DO UPDATE SET xp = user_levels.xp + EXCLUDED.xp, updated_at = now();
    END IF;
  END IF;
  RETURN _newly;
END;
$$;

-- Trigger: on new global chat message → XP, milestone credits, achievements
CREATE OR REPLACE FUNCTION public.on_global_chat_message_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
  _new_xp integer;
  _new_level integer;
  _credit_bonus integer := 0;
BEGIN
  -- Skip bot/system messages
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.user_levels (user_id, xp, messages_sent)
  VALUES (NEW.user_id, 5, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET messages_sent = user_levels.messages_sent + 1,
        xp = user_levels.xp + 5,
        updated_at = now()
  RETURNING messages_sent, xp INTO _new_count, _new_xp;

  -- Every 10 messages → +2 credits
  IF _new_count > 0 AND _new_count % 10 = 0 THEN
    _credit_bonus := 2;
    UPDATE public.profiles SET credits = credits + 2, updated_at = now()
      WHERE id = NEW.user_id;
    UPDATE public.user_levels SET chat_credits_earned = chat_credits_earned + 2
      WHERE user_id = NEW.user_id;
    BEGIN
      INSERT INTO public.credit_transactions (user_id, amount, balance, reason)
      SELECT NEW.user_id, 2, p.credits, 'Chat activity reward (10 messages)'
      FROM public.profiles p WHERE p.id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Level = floor(sqrt(xp / 50)) + 1 (simple curve)
  _new_level := GREATEST(1, FLOOR(SQRT(GREATEST(_new_xp, 0)::numeric / 50.0))::int + 1);
  UPDATE public.user_levels SET level = _new_level WHERE user_id = NEW.user_id AND level <> _new_level;

  -- Milestone achievements
  IF _new_count = 1 THEN PERFORM public.unlock_achievement(NEW.user_id, 'first_message'); END IF;
  IF _new_count = 10 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_10'); END IF;
  IF _new_count = 100 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_100'); END IF;
  IF _new_count = 500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_500'); END IF;
  IF _new_count = 1000 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_1000'); END IF;
  IF _new_level >= 5 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_5'); END IF;
  IF _new_level >= 10 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_10'); END IF;
  IF _new_level >= 25 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_25'); END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_chat_reward ON public.global_chat_messages;
CREATE TRIGGER trg_global_chat_reward
AFTER INSERT ON public.global_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.on_global_chat_message_reward();

-- Gallery achievements trigger
CREATE OR REPLACE FUNCTION public.on_gallery_post_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.unlock_achievement(NEW.user_id, 'first_gallery');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gallery_reward ON public.gallery_posts;
CREATE TRIGGER trg_gallery_reward AFTER INSERT ON public.gallery_posts
FOR EACH ROW EXECUTE FUNCTION public.on_gallery_post_reward();

-- Follower achievement
CREATE OR REPLACE FUNCTION public.on_follow_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.unlock_achievement(NEW.following_id, 'first_follower');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_follow_reward ON public.user_follows;
CREATE TRIGGER trg_follow_reward AFTER INSERT ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.on_follow_reward();

-- Seed catalog
INSERT INTO public.achievements (key, name, description, icon, category, xp_reward, credit_reward, sort_order) VALUES
  ('first_message', 'First Words', 'Send your first chat message', 'MessageCircle', 'chat', 10, 1, 1),
  ('chatty_10', 'Getting Warmed Up', 'Send 10 chat messages', 'MessageSquare', 'chat', 20, 2, 2),
  ('chatty_100', 'Community Voice', 'Send 100 chat messages', 'Megaphone', 'chat', 50, 5, 3),
  ('chatty_500', 'Chat Champion', 'Send 500 chat messages', 'Trophy', 'chat', 150, 15, 4),
  ('chatty_1000', 'Legendary Talker', 'Send 1,000 chat messages', 'Crown', 'chat', 400, 40, 5),
  ('level_5', 'Rising Star', 'Reach level 5', 'Star', 'level', 25, 3, 10),
  ('level_10', 'Veteran Builder', 'Reach level 10', 'Sparkles', 'level', 75, 8, 11),
  ('level_25', 'Master Crafter', 'Reach level 25', 'Gem', 'level', 250, 25, 12),
  ('first_gallery', 'Show & Tell', 'Share your first gallery post', 'Image', 'gallery', 15, 2, 20),
  ('first_follower', 'Influencer', 'Get your first follower', 'Users', 'social', 15, 2, 30)
ON CONFLICT (key) DO NOTHING;
