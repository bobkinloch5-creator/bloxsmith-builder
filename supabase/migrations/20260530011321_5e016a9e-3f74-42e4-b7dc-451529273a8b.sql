
-- ============ Extend global_chat_messages ============
ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.global_chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_reason text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gcm_pinned ON public.global_chat_messages(pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gcm_reply_to ON public.global_chat_messages(reply_to_id);

-- ============ Reactions ============
CREATE TABLE IF NOT EXISTS public.global_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.global_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.global_chat_reactions TO authenticated;
GRANT SELECT ON public.global_chat_reactions TO anon;
GRANT ALL ON public.global_chat_reactions TO service_role;
ALTER TABLE public.global_chat_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable" ON public.global_chat_reactions FOR SELECT USING (true);
CREATE POLICY "reactions insert own" ON public.global_chat_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions delete own or admin" ON public.global_chat_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ============ Reports ============
CREATE TABLE IF NOT EXISTS public.global_chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.global_chat_messages(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE ON public.global_chat_reports TO authenticated;
GRANT ALL ON public.global_chat_reports TO service_role;
ALTER TABLE public.global_chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports insert by user" ON public.global_chat_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports view own or admin" ON public.global_chat_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "reports update admin" ON public.global_chat_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ============ Audit log ============
CREATE TABLE IF NOT EXISTS public.global_chat_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_message_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_chat_audit TO authenticated;
GRANT ALL ON public.global_chat_audit TO service_role;
ALTER TABLE public.global_chat_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.global_chat_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ============ Warnings ============
CREATE TABLE IF NOT EXISTS public.global_chat_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issued_by uuid NOT NULL,
  reason text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.global_chat_warnings TO authenticated;
GRANT ALL ON public.global_chat_warnings TO service_role;
ALTER TABLE public.global_chat_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warnings view own or admin" ON public.global_chat_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "warnings ack own" ON public.global_chat_warnings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ Blocked words ============
CREATE TABLE IF NOT EXISTS public.global_chat_blocked_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'block',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.global_chat_blocked_words TO authenticated;
GRANT ALL ON public.global_chat_blocked_words TO service_role;
ALTER TABLE public.global_chat_blocked_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked words admin manage" ON public.global_chat_blocked_words FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ============ User prefs (customization) ============
CREATE TABLE IF NOT EXISTS public.global_chat_user_prefs (
  user_id uuid PRIMARY KEY,
  name_color text,
  message_gradient text,
  badge_icon text,
  font_size text NOT NULL DEFAULT 'md',
  density text NOT NULL DEFAULT 'cozy',
  sound_enabled boolean NOT NULL DEFAULT true,
  notify_mode text NOT NULL DEFAULT 'mentions',
  theme_accent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_chat_user_prefs TO anon, authenticated;
GRANT INSERT, UPDATE ON public.global_chat_user_prefs TO authenticated;
GRANT ALL ON public.global_chat_user_prefs TO service_role;
ALTER TABLE public.global_chat_user_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs public read" ON public.global_chat_user_prefs FOR SELECT USING (true);
CREATE POLICY "prefs upsert own" ON public.global_chat_user_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs update own" ON public.global_chat_user_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ Settings additions ============
ALTER TABLE public.global_chat_settings
  ADD COLUMN IF NOT EXISTS profanity_filter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_moderation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_message_length int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS allow_attachments boolean NOT NULL DEFAULT true;

-- ============ Storage bucket for attachments ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments auth upload" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments owner delete" ON storage.objects;
CREATE POLICY "chat-attachments public read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');
CREATE POLICY "chat-attachments auth upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat-attachments owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')));

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_reports;

-- ============ RPC: send message with reply / attachment ============
CREATE OR REPLACE FUNCTION public.send_global_chat_message_v2(
  _content text,
  _reply_to_id uuid DEFAULT NULL,
  _attachment_url text DEFAULT NULL,
  _attachment_type text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slow int;
  _max_len int;
  _allow_att boolean;
  _last timestamptz;
  _muted timestamptz;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT slow_mode_seconds, max_message_length, allow_attachments
    INTO _slow, _max_len, _allow_att
    FROM public.global_chat_settings WHERE id = 1;

  IF _attachment_url IS NOT NULL AND NOT COALESCE(_allow_att, true) THEN
    RAISE EXCEPTION 'attachments_disabled';
  END IF;

  IF length(coalesce(_content, '')) > COALESCE(_max_len, 500) THEN
    RAISE EXCEPTION 'message_too_long';
  END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN
    RAISE EXCEPTION 'muted_until %', _muted;
  END IF;

  IF COALESCE(_slow, 0) > 0 THEN
    SELECT max(created_at) INTO _last FROM public.global_chat_messages
      WHERE user_id = _uid AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN
      RAISE EXCEPTION 'slow_mode % seconds', _slow;
    END IF;
  END IF;

  -- duplicate detection: same content from same user in last 30s
  IF _content IS NOT NULL AND length(_content) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.global_chat_messages
      WHERE user_id = _uid AND content = _content
        AND created_at > now() - interval '30 seconds'
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'duplicate_message';
    END IF;
  END IF;

  INSERT INTO public.global_chat_messages (user_id, content, reply_to_id, attachment_url, attachment_type)
  VALUES (_uid, COALESCE(_content, ''), _reply_to_id, _attachment_url, _attachment_type)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text) TO authenticated;

-- ============ RPC: pin/unpin ============
CREATE OR REPLACE FUNCTION public.admin_chat_pin_message(_message_id uuid, _pin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _pin THEN
    UPDATE public.global_chat_messages SET pinned_at = now(), pinned_by = auth.uid() WHERE id = _message_id;
  ELSE
    UPDATE public.global_chat_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = _message_id;
  END IF;
  INSERT INTO public.global_chat_audit (actor_id, action, target_message_id, details)
    VALUES (auth.uid(), CASE WHEN _pin THEN 'pin' ELSE 'unpin' END, _message_id, NULL);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_pin_message(uuid, boolean) TO authenticated;

-- ============ RPC: warn user ============
CREATE OR REPLACE FUNCTION public.admin_chat_warn(_user_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.global_chat_warnings (user_id, issued_by, reason)
    VALUES (_user_id, auth.uid(), _reason) RETURNING id INTO _id;
  INSERT INTO public.global_chat_audit (actor_id, action, target_user_id, details)
    VALUES (auth.uid(), 'warn', _user_id, jsonb_build_object('reason', _reason));
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_chat_warn(uuid, text) TO authenticated;

-- ============ Audit triggers for existing mod RPCs ============
-- Wrap log inserts into existing admin functions by adding triggers on mutes table
CREATE OR REPLACE FUNCTION public.log_mute_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.global_chat_audit (actor_id, action, target_user_id, details)
    VALUES (auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN 'unmute' ELSE 'mute' END,
      COALESCE(NEW.user_id, OLD.user_id),
      jsonb_build_object('muted_until', NEW.muted_until, 'reason', NEW.reason));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_log_mute_change ON public.global_chat_mutes;
CREATE TRIGGER trg_log_mute_change AFTER INSERT OR UPDATE OR DELETE
  ON public.global_chat_mutes FOR EACH ROW EXECUTE FUNCTION public.log_mute_change();

CREATE OR REPLACE FUNCTION public.log_message_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.global_chat_audit (actor_id, action, target_user_id, target_message_id)
      VALUES (auth.uid(), 'delete_message', NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_message_delete ON public.global_chat_messages;
CREATE TRIGGER trg_log_message_delete AFTER UPDATE ON public.global_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_message_delete();
