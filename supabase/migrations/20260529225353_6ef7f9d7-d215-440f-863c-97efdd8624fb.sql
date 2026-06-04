
-- Messages
CREATE TABLE public.global_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_gcm_created ON public.global_chat_messages(created_at DESC);
GRANT SELECT ON public.global_chat_messages TO authenticated;
GRANT ALL ON public.global_chat_messages TO service_role;
ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read non-deleted" ON public.global_chat_messages
  FOR SELECT TO authenticated USING (deleted_at IS NULL OR public.is_admin(auth.uid()));

-- Settings (singleton)
CREATE TABLE public.global_chat_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  slow_mode_seconds int NOT NULL DEFAULT 0 CHECK (slow_mode_seconds BETWEEN 0 AND 3600),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.global_chat_settings(id) VALUES (1);
GRANT SELECT ON public.global_chat_settings TO authenticated;
GRANT ALL ON public.global_chat_settings TO service_role;
ALTER TABLE public.global_chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read settings" ON public.global_chat_settings
  FOR SELECT TO authenticated USING (true);

-- Mutes
CREATE TABLE public.global_chat_mutes (
  user_id uuid PRIMARY KEY,
  muted_until timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_chat_mutes TO authenticated;
GRANT ALL ON public.global_chat_mutes TO service_role;
ALTER TABLE public.global_chat_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read own mute" ON public.global_chat_mutes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Send RPC: enforces ban, mute, slow mode
CREATE OR REPLACE FUNCTION public.send_global_chat_message(_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _banned boolean;
  _mute_until timestamptz;
  _slow int;
  _last timestamptz;
  _id uuid;
  _txt text := trim(_content);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _txt IS NULL OR char_length(_txt) = 0 THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_txt) > 500 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT banned INTO _banned FROM public.profiles WHERE id = _uid;
  IF _banned THEN RAISE EXCEPTION 'banned'; END IF;

  SELECT muted_until INTO _mute_until FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _mute_until IS NOT NULL AND _mute_until > now() THEN RAISE EXCEPTION 'muted'; END IF;

  IF NOT public.is_admin(_uid) THEN
    SELECT slow_mode_seconds INTO _slow FROM public.global_chat_settings WHERE id = 1;
    IF COALESCE(_slow,0) > 0 THEN
      SELECT max(created_at) INTO _last FROM public.global_chat_messages
        WHERE user_id = _uid AND created_at > now() - make_interval(secs => _slow);
      IF _last IS NOT NULL THEN RAISE EXCEPTION 'slow_mode'; END IF;
    END IF;
  END IF;

  INSERT INTO public.global_chat_messages(user_id, content) VALUES (_uid, _txt) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message(text) TO authenticated;

-- Admin: delete one message (soft)
CREATE OR REPLACE FUNCTION public.admin_chat_delete_message(_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.global_chat_messages SET deleted_at = now(), deleted_by = auth.uid()
    WHERE id = _message_id AND deleted_at IS NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_delete_message(uuid) TO authenticated;

-- Admin: clear all
CREATE OR REPLACE FUNCTION public.admin_chat_clear_all()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.global_chat_messages SET deleted_at = now(), deleted_by = auth.uid() WHERE deleted_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_clear_all() TO authenticated;

-- Admin: slow mode
CREATE OR REPLACE FUNCTION public.admin_chat_set_slow_mode(_seconds int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _seconds < 0 OR _seconds > 3600 THEN RAISE EXCEPTION 'invalid_seconds'; END IF;
  UPDATE public.global_chat_settings SET slow_mode_seconds = _seconds, updated_at = now(), updated_by = auth.uid() WHERE id = 1;
  RETURN _seconds;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_set_slow_mode(int) TO authenticated;

-- Admin: mute / unmute
CREATE OR REPLACE FUNCTION public.admin_chat_mute(_user_id uuid, _minutes int, _reason text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _until timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.has_role(_user_id, 'owner') THEN RAISE EXCEPTION 'cannot_mute_owner'; END IF;
  _until := CASE WHEN _minutes IS NULL OR _minutes <= 0 THEN now() + interval '100 years' ELSE now() + make_interval(mins => _minutes) END;
  INSERT INTO public.global_chat_mutes(user_id, muted_until, reason, created_by)
    VALUES (_user_id, _until, _reason, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET muted_until = EXCLUDED.muted_until, reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now();
  RETURN _until;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_mute(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_chat_unmute(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.global_chat_mutes WHERE user_id = _user_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_unmute(uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_settings;
