-- Ensure signed-in users can self-heal missing BloxSmith account rows without touching auth schema triggers.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email', ''));
  _name text := coalesce(
    auth.jwt()->'user_metadata'->>'display_name',
    auth.jwt()->'user_metadata'->>'full_name',
    nullif(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1), ''),
    'BloxSmith Builder'
  );
  _avatar text := auth.jwt()->'user_metadata'->>'avatar_url';
  _is_owner boolean;
  _inserted boolean := false;
  _starter int;
  _ref text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 10 END;
  _ref := lower(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code)
  VALUES (_uid, nullif(_email, ''), _name, _avatar, _starter, _ref)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    UPDATE public.profiles
      SET email = coalesce(nullif(_email, ''), email),
          display_name = coalesce(display_name, _name),
          avatar_url = coalesce(avatar_url, _avatar),
          updated_at = now()
      WHERE id = _uid;
  ELSE
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (_uid, _starter, _starter, 'starter')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, 'user')
  ON CONFLICT DO NOTHING;

  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- User badges shown in chat/profile.
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge)
);
GRANT SELECT ON public.user_badges TO anon;
GRANT SELECT, INSERT, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges are readable" ON public.user_badges;
CREATE POLICY "badges are readable" ON public.user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage badges" ON public.user_badges;
CREATE POLICY "admins manage badges" ON public.user_badges FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Follow graph.
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.user_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows readable" ON public.user_follows;
CREATE POLICY "follows readable" ON public.user_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "users manage own follows" ON public.user_follows;
CREATE POLICY "users manage own follows" ON public.user_follows FOR ALL TO authenticated
USING (auth.uid() = follower_id)
WITH CHECK (auth.uid() = follower_id);

-- Friend requests.
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friends visible to participants" ON public.friend_requests;
CREATE POLICY "friends visible to participants" ON public.friend_requests FOR SELECT TO authenticated
USING (auth.uid() IN (requester_id, addressee_id) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "users create own friend requests" ON public.friend_requests;
CREATE POLICY "users create own friend requests" ON public.friend_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "participants update friend requests" ON public.friend_requests;
CREATE POLICY "participants update friend requests" ON public.friend_requests FOR UPDATE TO authenticated
USING (auth.uid() IN (requester_id, addressee_id) OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() IN (requester_id, addressee_id) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "requesters delete friend requests" ON public.friend_requests;
CREATE POLICY "requesters delete friend requests" ON public.friend_requests FOR DELETE TO authenticated
USING (auth.uid() = requester_id OR public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS touch_friend_requests ON public.friend_requests;
CREATE TRIGGER touch_friend_requests BEFORE UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Direct messages.
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm visible to participants" ON public.direct_messages;
CREATE POLICY "dm visible to participants" ON public.direct_messages FOR SELECT TO authenticated
USING (auth.uid() IN (sender_id, recipient_id) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "users send own dm" ON public.direct_messages;
CREATE POLICY "users send own dm" ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "recipients mark dm read" ON public.direct_messages;
CREATE POLICY "recipients mark dm read" ON public.direct_messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = recipient_id OR public.is_admin(auth.uid()));

-- Per-user local mutes for chat UI.
CREATE TABLE IF NOT EXISTS public.user_chat_local_mutes (
  user_id uuid NOT NULL,
  muted_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_user_id),
  CHECK (user_id <> muted_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_chat_local_mutes TO authenticated;
GRANT ALL ON public.user_chat_local_mutes TO service_role;
ALTER TABLE public.user_chat_local_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own local mutes" ON public.user_chat_local_mutes;
CREATE POLICY "users manage own local mutes" ON public.user_chat_local_mutes FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff quick changelog entries.
CREATE TABLE IF NOT EXISTS public.quick_changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quick_changelog_entries TO anon;
GRANT SELECT, INSERT ON public.quick_changelog_entries TO authenticated;
GRANT ALL ON public.quick_changelog_entries TO service_role;
ALTER TABLE public.quick_changelog_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quick changelog readable" ON public.quick_changelog_entries;
CREATE POLICY "quick changelog readable" ON public.quick_changelog_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins create quick changelog" ON public.quick_changelog_entries;
CREATE POLICY "admins create quick changelog" ON public.quick_changelog_entries FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS showcase_featured_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_projects_showcase_featured_at ON public.projects(showcase_featured_at) WHERE showcase_featured_at IS NOT NULL;

ALTER TABLE public.global_chat_reports ALTER COLUMN message_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_grant_badge(_user_id uuid, _badge text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _clean text := lower(trim(_badge));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _clean IS NULL OR _clean = '' OR char_length(_clean) > 40 THEN RAISE EXCEPTION 'invalid_badge'; END IF;
  INSERT INTO public.user_badges(user_id, badge, granted_by)
  VALUES (_user_id, _clean, auth.uid())
  ON CONFLICT (user_id, badge) DO NOTHING;
  INSERT INTO public.global_chat_audit(actor_id, action, target_user_id, details)
  VALUES (auth.uid(), 'grant_badge', _user_id, jsonb_build_object('badge', _clean));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_chat_announce(_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _txt text := trim(_content);
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _txt IS NULL OR _txt = '' OR char_length(_txt) > 500 THEN RAISE EXCEPTION 'invalid_announcement'; END IF;
  INSERT INTO public.global_chat_messages(user_id, content, pinned_at, pinned_by)
  VALUES (_uid, '📣 Announcement: ' || _txt, now(), _uid)
  RETURNING id INTO _id;
  INSERT INTO public.global_chat_audit(actor_id, action, target_message_id, details)
  VALUES (_uid, 'announce', _id, jsonb_build_object('content', _txt));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_chat_announce(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_feature_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.projects
    SET showcase_published = true,
        showcase_published_at = coalesce(showcase_published_at, now()),
        showcase_featured_at = now(),
        updated_at = now()
    WHERE id = _project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  INSERT INTO public.global_chat_audit(actor_id, action, details)
  VALUES (auth.uid(), 'feature_project', jsonb_build_object('project_id', _project_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_feature_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_quick_changelog(_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; _txt text := trim(_message);
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _txt IS NULL OR _txt = '' OR char_length(_txt) > 500 THEN RAISE EXCEPTION 'invalid_changelog'; END IF;
  INSERT INTO public.quick_changelog_entries(message, created_by)
  VALUES (_txt, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.global_chat_audit(actor_id, action, details)
  VALUES (auth.uid(), 'quick_changelog', jsonb_build_object('message', _txt));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_quick_changelog(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_chat_user(_reported_user_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; _txt text := nullif(trim(_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _reported_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_report_self'; END IF;
  INSERT INTO public.global_chat_reports(message_id, reported_user_id, reporter_id, reason)
  VALUES (NULL, _reported_user_id, auth.uid(), coalesce(_txt, 'No reason provided'))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.report_chat_user(uuid, text) TO authenticated;

-- Harden v2 message sending with profile self-heal and ban checks.
CREATE OR REPLACE FUNCTION public.send_global_chat_message_v2(_content text, _reply_to_id uuid DEFAULT NULL::uuid, _attachment_url text DEFAULT NULL::text, _attachment_type text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slow int;
  _max_len int;
  _allow_att boolean;
  _last timestamptz;
  _muted timestamptz;
  _banned boolean;
  _new_id uuid;
  _txt text := trim(coalesce(_content, ''));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.ensure_my_profile();

  SELECT banned INTO _banned FROM public.profiles WHERE id = _uid;
  IF COALESCE(_banned, false) THEN RAISE EXCEPTION 'banned'; END IF;

  SELECT slow_mode_seconds, max_message_length, allow_attachments
    INTO _slow, _max_len, _allow_att
    FROM public.global_chat_settings WHERE id = 1;

  IF _attachment_url IS NOT NULL AND NOT COALESCE(_allow_att, true) THEN
    RAISE EXCEPTION 'attachments_disabled';
  END IF;

  IF _txt = '' AND _attachment_url IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(_txt) > COALESCE(_max_len, 500) THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN
    RAISE EXCEPTION 'muted_until %', _muted;
  END IF;

  IF COALESCE(_slow, 0) > 0 AND NOT public.is_admin(_uid) THEN
    SELECT max(created_at) INTO _last FROM public.global_chat_messages
      WHERE user_id = _uid AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN RAISE EXCEPTION 'slow_mode % seconds', _slow; END IF;
  END IF;

  IF _txt <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.global_chat_messages
      WHERE user_id = _uid AND content = _txt
        AND created_at > now() - interval '30 seconds'
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'duplicate_message';
    END IF;
  END IF;

  INSERT INTO public.global_chat_messages (user_id, content, reply_to_id, attachment_url, attachment_type)
  VALUES (_uid, _txt, _reply_to_id, _attachment_url, _attachment_type)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text) TO authenticated;