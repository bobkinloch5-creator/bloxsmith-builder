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
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.user_levels (user_id, xp, messages_sent)
  VALUES (NEW.user_id, 5, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET messages_sent = user_levels.messages_sent + 1,
        xp = user_levels.xp + 5,
        updated_at = now()
  RETURNING messages_sent, xp INTO _new_count, _new_xp;

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

  _new_level := GREATEST(1, FLOOR(SQRT(GREATEST(_new_xp, 0)::numeric / 50.0))::int + 1);
  UPDATE public.user_levels SET level = _new_level WHERE user_id = NEW.user_id AND level <> _new_level;

  IF _new_count = 1 THEN PERFORM public.unlock_achievement(NEW.user_id, 'first_message'); END IF;
  IF _new_count = 10 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_10'); END IF;
  IF _new_count = 25 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_25'); END IF;
  IF _new_count = 50 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_50'); END IF;
  IF _new_count = 100 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_100'); END IF;
  IF _new_count = 250 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_250'); END IF;
  IF _new_count = 500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_500'); END IF;
  IF _new_count = 1000 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_1000'); END IF;
  IF _new_count = 2500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_2500'); END IF;
  IF _new_count = 5000 THEN PERFORM public.unlock_achievement(NEW.user_id, 'chatty_5000'); END IF;

  IF _new_level >= 2 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_2'); END IF;
  IF _new_level >= 3 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_3'); END IF;
  IF _new_level >= 5 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_5'); END IF;
  IF _new_level >= 10 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_10'); END IF;
  IF _new_level >= 15 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_15'); END IF;
  IF _new_level >= 25 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_25'); END IF;
  IF _new_level >= 50 THEN PERFORM public.unlock_achievement(NEW.user_id, 'level_50'); END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_gallery_post_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_count integer;
BEGIN
  PERFORM public.unlock_achievement(NEW.user_id, 'first_gallery');
  SELECT count(*) INTO _post_count FROM public.gallery_posts WHERE user_id = NEW.user_id;
  IF _post_count >= 3 THEN PERFORM public.unlock_achievement(NEW.user_id, 'gallery_3'); END IF;
  IF _post_count >= 10 THEN PERFORM public.unlock_achievement(NEW.user_id, 'gallery_10'); END IF;
  IF _post_count >= 25 THEN PERFORM public.unlock_achievement(NEW.user_id, 'gallery_25'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_follow_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _follower_count integer;
BEGIN
  PERFORM public.unlock_achievement(NEW.following_id, 'first_follower');
  SELECT count(*) INTO _follower_count FROM public.user_follows WHERE following_id = NEW.following_id;
  IF _follower_count >= 5 THEN PERFORM public.unlock_achievement(NEW.following_id, 'followers_5'); END IF;
  IF _follower_count >= 25 THEN PERFORM public.unlock_achievement(NEW.following_id, 'followers_25'); END IF;
  IF _follower_count >= 100 THEN PERFORM public.unlock_achievement(NEW.following_id, 'followers_100'); END IF;
  RETURN NEW;
END;
$$;