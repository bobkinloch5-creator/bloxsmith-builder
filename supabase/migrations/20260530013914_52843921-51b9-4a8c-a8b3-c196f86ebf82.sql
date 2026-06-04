CREATE OR REPLACE FUNCTION public.send_global_chat_message_v2(
  _content text,
  _reply_to_id uuid DEFAULT NULL,
  _attachment_url text DEFAULT NULL,
  _attachment_type text DEFAULT NULL,
  _channel_id text DEFAULT 'general'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slow int; _max_len int; _allow_att boolean;
  _last timestamptz; _muted timestamptz; _banned boolean;
  _new_id uuid;
  _txt text := trim(coalesce(_content, ''));
  _chan text := coalesce(nullif(trim(_channel_id), ''), 'general');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.ensure_my_profile();

  IF NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE slug = _chan) THEN
    RAISE EXCEPTION 'unknown_channel';
  END IF;
  IF NOT public.can_post_channel(_chan, _uid) THEN
    RAISE EXCEPTION 'forbidden_channel';
  END IF;

  SELECT banned INTO _banned FROM public.profiles WHERE id = _uid;
  IF COALESCE(_banned, false) THEN RAISE EXCEPTION 'banned'; END IF;

  SELECT slow_mode_seconds, max_message_length, allow_attachments
    INTO _slow, _max_len, _allow_att FROM public.global_chat_settings WHERE id = 1;

  IF _attachment_url IS NOT NULL AND NOT COALESCE(_allow_att, true) THEN
    RAISE EXCEPTION 'attachments_disabled';
  END IF;
  IF _txt = '' AND _attachment_url IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(_txt) > COALESCE(_max_len, 500) THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN RAISE EXCEPTION 'muted_until %', _muted; END IF;

  IF COALESCE(_slow, 0) > 0 AND NOT public.is_admin(_uid) THEN
    SELECT max(created_at) INTO _last FROM public.global_chat_messages
      WHERE user_id = _uid AND channel_id = _chan AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN RAISE EXCEPTION 'slow_mode % seconds', _slow; END IF;
  END IF;

  IF _txt <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.global_chat_messages
      WHERE user_id = _uid AND content = _txt AND channel_id = _chan
        AND created_at > now() - interval '30 seconds' AND deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'duplicate_message'; END IF;
  END IF;

  INSERT INTO public.global_chat_messages (user_id, content, reply_to_id, attachment_url, attachment_type, channel_id)
  VALUES (_uid, _txt, _reply_to_id, _attachment_url, _attachment_type, _chan)
  RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) TO authenticated;