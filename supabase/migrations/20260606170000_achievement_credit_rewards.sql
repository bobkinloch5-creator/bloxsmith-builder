-- Achievement rewards repair and 3D achievement expansion.
--
-- Rewards are granted automatically and exactly once when the
-- user_achievements row is first inserted. The project has used both
-- profiles.credits and user_credits.balance, so new rewards update both when
-- they exist. Ledger writes are best-effort across both historical schemas.

INSERT INTO public.achievements
  (key, name, description, icon, category, xp_reward, credit_reward, sort_order)
VALUES
  ('chatty_25', 'Conversation Starter', 'Send 25 chat messages', 'MessagesSquare', 'chat', 30, 2, 3),
  ('chatty_50', 'Community Regular', 'Send 50 chat messages', 'MessageCircleMore', 'chat', 40, 3, 4),
  ('chatty_250', 'Known Voice', 'Send 250 chat messages', 'Radio', 'chat', 100, 8, 6),
  ('chatty_2500', 'Community Icon', 'Send 2,500 chat messages', 'Medal', 'chat', 700, 25, 9),
  ('chatty_5000', 'BloxSmith Broadcaster', 'Send 5,000 chat messages', 'Crown', 'chat', 1200, 50, 10),
  ('level_2', 'First Level Up', 'Reach level 2', 'TrendingUp', 'level', 15, 1, 11),
  ('level_3', 'On a Roll', 'Reach level 3', 'Zap', 'level', 20, 2, 12),
  ('level_15', 'Expert Builder', 'Reach level 15', 'BadgeCheck', 'level', 120, 12, 16),
  ('level_50', 'BloxSmith Legend', 'Reach level 50', 'Crown', 'level', 600, 50, 18),
  ('gallery_3', 'Gallery Regular', 'Share 3 gallery posts', 'Images', 'gallery', 30, 3, 21),
  ('gallery_10', 'Showcase Creator', 'Share 10 gallery posts', 'GalleryHorizontalEnd', 'gallery', 80, 8, 22),
  ('gallery_25', 'Featured Artist', 'Share 25 gallery posts', 'Palette', 'gallery', 200, 20, 23),
  ('followers_5', 'Growing Audience', 'Reach 5 followers', 'UserRoundPlus', 'social', 40, 4, 31),
  ('followers_25', 'Community Creator', 'Reach 25 followers', 'UsersRound', 'social', 120, 12, 32),
  ('followers_100', 'BloxSmith Influencer', 'Reach 100 followers', 'BadgeCheck', 'social', 300, 30, 33),
  ('first_3d_model', '3D Model Maker', 'Generate your first successful 3D model', 'Box', '3d studio', 50, 5, 90),
  ('first_rigged_model', 'Skeleton Crew', 'Generate your first model with a real skeleton', 'Bone', '3d studio', 80, 8, 91),
  ('first_animated_model', 'Model in Motion', 'Generate your first model with a baked animation', 'PersonStanding', '3d studio', 100, 10, 92)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  xp_reward = EXCLUDED.xp_reward,
  credit_reward = EXCLUDED.credit_reward,
  sort_order = EXCLUDED.sort_order;

-- Every real achievement should have a credit reward.
UPDATE public.achievements
SET credit_reward = 10
WHERE key = 'mod_helper' AND credit_reward <= 0;

CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ach public.achievements%ROWTYPE;
  _newly boolean := false;
  _inserted integer := 0;
  _profile_balance integer;
  _xp integer;
  _level integer;
  _reason text;
BEGIN
  IF _user_id IS NULL OR nullif(trim(_key), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _ach
  FROM public.achievements
  WHERE key = trim(_key);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_key)
  VALUES (_user_id, _ach.key)
  ON CONFLICT (user_id, achievement_key) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  _newly := _inserted > 0;

  IF NOT _newly THEN
    RETURN false;
  END IF;

  IF _ach.credit_reward > 0 THEN
    UPDATE public.profiles
    SET credits = COALESCE(credits, 0) + _ach.credit_reward,
        updated_at = now()
    WHERE id = _user_id
    RETURNING credits INTO _profile_balance;

    -- Some deployments still spend from user_credits. Keep that balance in
    -- step so achievement credits are actually usable there too.
    IF to_regclass('public.user_credits') IS NOT NULL THEN
      BEGIN
        EXECUTE
          'INSERT INTO public.user_credits (user_id, balance)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE
           SET balance = public.user_credits.balance + EXCLUDED.balance,
               updated_at = now()'
        USING _user_id, _ach.credit_reward;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    _reason := 'Achievement unlocked: ' || _ach.name;

    -- Support the newer tx_type/description ledger.
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'tx_type'
      ) THEN
        EXECUTE
          'INSERT INTO public.credit_transactions
             (user_id, amount, tx_type, description, metadata)
           VALUES ($1, $2, ''grant'', $3, jsonb_build_object(''achievement_key'', $4))'
        USING _user_id, _ach.credit_reward, _reason, _ach.key;
      ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'balance'
      ) THEN
        EXECUTE
          'INSERT INTO public.credit_transactions
             (user_id, amount, balance, reason)
           VALUES ($1, $2, $3, $4)'
        USING _user_id, _ach.credit_reward, COALESCE(_profile_balance, 0), _reason;
      ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_transactions'
          AND column_name = 'type'
      ) THEN
        EXECUTE
          'INSERT INTO public.credit_transactions
             (user_id, amount, type, reason)
           VALUES ($1, $2, ''grant'', $3)'
        USING _user_id, _ach.credit_reward, _reason;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- The reward is authoritative; ledger drift must not undo it.
      NULL;
    END;
  END IF;

  IF _ach.xp_reward > 0 THEN
    INSERT INTO public.user_levels (user_id, xp)
    VALUES (_user_id, _ach.xp_reward)
    ON CONFLICT (user_id) DO UPDATE
      SET xp = public.user_levels.xp + EXCLUDED.xp,
          updated_at = now()
    RETURNING xp INTO _xp;

    _level := GREATEST(
      1,
      FLOOR(SQRT(GREATEST(COALESCE(_xp, 0), 0)::numeric / 50.0))::integer + 1
    );
    UPDATE public.user_levels
    SET level = _level,
        updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  RETURN true;
END;
$$;

-- Users must earn achievements through trusted triggers/server code, not by
-- calling the SECURITY DEFINER reward function themselves.
REVOKE ALL ON FUNCTION public.unlock_achievement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.on_3d_generation_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _animation text := lower(COALESCE(NEW.settings ->> 'modelAnimation', 'none'));
BEGIN
  IF NEW.status <> 'success' OR NEW.generation_type <> 'model' THEN
    RETURN NEW;
  END IF;

  PERFORM public.unlock_achievement(NEW.user_id, 'first_3d_model');

  IF lower(COALESCE(NEW.settings ->> 'rigged', 'false')) IN ('true', '1', 'yes') THEN
    PERFORM public.unlock_achievement(NEW.user_id, 'first_rigged_model');
  END IF;

  IF _animation NOT IN ('', 'none') THEN
    PERFORM public.unlock_achievement(NEW.user_id, 'first_animated_model');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_3d_generation_achievement ON public.model_generations_3d;
CREATE TRIGGER trg_3d_generation_achievement
AFTER INSERT ON public.model_generations_3d
FOR EACH ROW EXECUTE FUNCTION public.on_3d_generation_achievement();

-- Award missing milestone definitions retroactively. unlock_achievement is
-- idempotent, so rerunning this migration cannot duplicate rewards.
DO $backfill$
DECLARE
  _row record;
  _current_level integer;
BEGIN
  FOR _row IN SELECT user_id, messages_sent, level FROM public.user_levels LOOP
    IF _row.messages_sent >= 25 THEN PERFORM public.unlock_achievement(_row.user_id, 'chatty_25'); END IF;
    IF _row.messages_sent >= 50 THEN PERFORM public.unlock_achievement(_row.user_id, 'chatty_50'); END IF;
    IF _row.messages_sent >= 250 THEN PERFORM public.unlock_achievement(_row.user_id, 'chatty_250'); END IF;
    IF _row.messages_sent >= 2500 THEN PERFORM public.unlock_achievement(_row.user_id, 'chatty_2500'); END IF;
    IF _row.messages_sent >= 5000 THEN PERFORM public.unlock_achievement(_row.user_id, 'chatty_5000'); END IF;
    SELECT level INTO _current_level FROM public.user_levels WHERE user_id = _row.user_id;
    IF _current_level >= 2 THEN PERFORM public.unlock_achievement(_row.user_id, 'level_2'); END IF;
    IF _current_level >= 3 THEN PERFORM public.unlock_achievement(_row.user_id, 'level_3'); END IF;
    IF _current_level >= 15 THEN PERFORM public.unlock_achievement(_row.user_id, 'level_15'); END IF;
    IF _current_level >= 50 THEN PERFORM public.unlock_achievement(_row.user_id, 'level_50'); END IF;
  END LOOP;

  FOR _row IN
    SELECT user_id, count(*)::integer AS total
    FROM public.gallery_posts
    GROUP BY user_id
  LOOP
    IF _row.total >= 3 THEN PERFORM public.unlock_achievement(_row.user_id, 'gallery_3'); END IF;
    IF _row.total >= 10 THEN PERFORM public.unlock_achievement(_row.user_id, 'gallery_10'); END IF;
    IF _row.total >= 25 THEN PERFORM public.unlock_achievement(_row.user_id, 'gallery_25'); END IF;
  END LOOP;

  FOR _row IN
    SELECT following_id AS user_id, count(*)::integer AS total
    FROM public.user_follows
    GROUP BY following_id
  LOOP
    IF _row.total >= 5 THEN PERFORM public.unlock_achievement(_row.user_id, 'followers_5'); END IF;
    IF _row.total >= 25 THEN PERFORM public.unlock_achievement(_row.user_id, 'followers_25'); END IF;
    IF _row.total >= 100 THEN PERFORM public.unlock_achievement(_row.user_id, 'followers_100'); END IF;
  END LOOP;

  FOR _row IN
    SELECT
      user_id,
      bool_or(lower(COALESCE(settings ->> 'rigged', 'false')) IN ('true', '1', 'yes')) AS rigged,
      bool_or(lower(COALESCE(settings ->> 'modelAnimation', 'none')) NOT IN ('', 'none')) AS animated
    FROM public.model_generations_3d
    WHERE status = 'success' AND generation_type = 'model'
    GROUP BY user_id
  LOOP
    PERFORM public.unlock_achievement(_row.user_id, 'first_3d_model');
    IF _row.rigged THEN PERFORM public.unlock_achievement(_row.user_id, 'first_rigged_model'); END IF;
    IF _row.animated THEN PERFORM public.unlock_achievement(_row.user_id, 'first_animated_model'); END IF;
  END LOOP;
END;
$backfill$;

NOTIFY pgrst, 'reload schema';
