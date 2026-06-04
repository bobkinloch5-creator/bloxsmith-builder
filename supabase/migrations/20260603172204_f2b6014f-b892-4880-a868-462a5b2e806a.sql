CREATE OR REPLACE FUNCTION public.send_global_chat_message_v2(_content text, _reply_to_id uuid DEFAULT NULL::uuid, _attachment_url text DEFAULT NULL::text, _attachment_type text DEFAULT NULL::text, _channel_id text DEFAULT 'general'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _slow integer := 0;
  _last timestamptz;
  _muted timestamptz;
  _txt text := trim(COALESCE(_content, ''));
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  PERFORM public.ensure_my_profile();

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND COALESCE(banned, false) = true) THEN
    RAISE EXCEPTION 'banned';
  END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN
    RAISE EXCEPTION 'muted';
  END IF;

  _is_admin := public.is_admin(_uid);

  SELECT slow_mode_seconds INTO _slow FROM public.global_chat_settings WHERE id = 1;
  IF COALESCE(_slow, 0) > 0 AND NOT _is_admin THEN
    SELECT max(created_at) INTO _last
    FROM public.global_chat_messages
    WHERE user_id = _uid AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN
      RAISE EXCEPTION 'slow_mode';
    END IF;
  END IF;

  IF _txt = '' AND _attachment_url IS NULL THEN
    RAISE EXCEPTION 'empty_message';
  END IF;

  -- Server-side blocked-word enforcement (admins bypass)
  IF _txt <> '' AND NOT _is_admin THEN
    IF EXISTS (
      SELECT 1 FROM public.global_chat_blocked_words bw
      WHERE lower(_txt) ~ ('(^|[^a-z0-9])' || lower(bw.word) || '([^a-z0-9]|$)')
    ) THEN
      RAISE EXCEPTION 'blocked_word';
    END IF;
  END IF;

  INSERT INTO public.global_chat_messages (user_id, content, reply_to_id, attachment_url, attachment_type, channel_id)
  VALUES (_uid, _txt, _reply_to_id, _attachment_url, _attachment_type, COALESCE(NULLIF(_channel_id, ''), 'general'))
  RETURNING id INTO _new_id;

  INSERT INTO public.user_levels (user_id, messages_sent, xp, level, updated_at)
  VALUES (_uid, 1, 5, 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET messages_sent = public.user_levels.messages_sent + 1,
      xp = public.user_levels.xp + 5,
      level = GREATEST(1, FLOOR(SQRT(GREATEST(public.user_levels.xp + 5, 0)::numeric / 50.0))::int + 1),
      updated_at = now();

  RETURN _new_id;
END;
$function$;