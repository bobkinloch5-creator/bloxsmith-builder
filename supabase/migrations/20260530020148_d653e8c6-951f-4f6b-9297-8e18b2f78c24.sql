
-- ===== FOLLOWS (table already exists with following_id column) =====
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT SELECT ON public.user_follows TO anon;
GRANT ALL ON public.user_follows TO service_role;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows readable" ON public.user_follows;
DROP POLICY IF EXISTS "follow self" ON public.user_follows;
DROP POLICY IF EXISTS "unfollow self" ON public.user_follows;
CREATE POLICY "follows readable" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "follow self" ON public.user_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "unfollow self" ON public.user_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_idx ON public.user_follows(following_id);

-- ===== USER REPORTS =====
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  reason text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  CHECK (reporter_id <> reported_user_id)
);
GRANT SELECT, INSERT ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ureports view" ON public.user_reports;
DROP POLICY IF EXISTS "ureports insert" ON public.user_reports;
DROP POLICY IF EXISTS "ureports update" ON public.user_reports;
CREATE POLICY "ureports view" ON public.user_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR is_admin(auth.uid()));
CREATE POLICY "ureports insert" ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "ureports update" ON public.user_reports FOR UPDATE TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ===== GALLERY =====
CREATE TABLE IF NOT EXISTS public.gallery_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  flagged boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gallery_posts TO authenticated;
GRANT SELECT ON public.gallery_posts TO anon;
GRANT ALL ON public.gallery_posts TO service_role;
ALTER TABLE public.gallery_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gallery visible" ON public.gallery_posts;
DROP POLICY IF EXISTS "gallery insert" ON public.gallery_posts;
DROP POLICY IF EXISTS "gallery update" ON public.gallery_posts;
CREATE POLICY "gallery visible" ON public.gallery_posts FOR SELECT
  USING (deleted_at IS NULL OR is_admin(auth.uid()));
CREATE POLICY "gallery insert" ON public.gallery_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gallery update" ON public.gallery_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS gallery_posts_user_idx ON public.gallery_posts(user_id);
CREATE INDEX IF NOT EXISTS gallery_posts_created_idx ON public.gallery_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.gallery_likes (
  post_id uuid NOT NULL REFERENCES public.gallery_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.gallery_likes TO authenticated;
GRANT SELECT ON public.gallery_likes TO anon;
GRANT ALL ON public.gallery_likes TO service_role;
ALTER TABLE public.gallery_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "glikes read" ON public.gallery_likes;
DROP POLICY IF EXISTS "glikes insert" ON public.gallery_likes;
DROP POLICY IF EXISTS "glikes delete" ON public.gallery_likes;
CREATE POLICY "glikes read" ON public.gallery_likes FOR SELECT USING (true);
CREATE POLICY "glikes insert" ON public.gallery_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "glikes delete" ON public.gallery_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.follow_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid = _target THEN RAISE EXCEPTION 'cannot follow self'; END IF;
  INSERT INTO public.user_follows(follower_id, following_id) VALUES (_uid, _target)
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.follow_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unfollow_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_follows WHERE follower_id = auth.uid() AND following_id = _target;
END $$;
GRANT EXECUTE ON FUNCTION public.unfollow_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_user(_target uuid, _reason text, _context text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid = _target THEN RAISE EXCEPTION 'cannot report self'; END IF;
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'reason required'; END IF;
  INSERT INTO public.user_reports(reporter_id, reported_user_id, reason, context)
  VALUES (_uid, _target, left(_reason, 200), left(coalesce(_context, ''), 1000))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_gallery_like(_post uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _exists boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.gallery_likes WHERE post_id = _post AND user_id = _uid) INTO _exists;
  IF _exists THEN
    DELETE FROM public.gallery_likes WHERE post_id = _post AND user_id = _uid;
    RETURN false;
  ELSE
    INSERT INTO public.gallery_likes(post_id, user_id) VALUES (_post, _uid);
    RETURN true;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.toggle_gallery_like(uuid) TO authenticated;

-- ===== LINK BLOCKING IN CHAT =====
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

  IF _txt ~* '(https?://|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|app|dev|store|club|link|tk|info|biz|fun|live|tv|ru|cn|us|uk)(/|$|\s))' THEN
    RAISE EXCEPTION 'links_not_allowed';
  END IF;
  IF _txt ~* '(discord\.gg|discord(app)?\.com|dsc\.gg|t\.me/|telegram\.me|bit\.ly|tinyurl|grabify)' THEN
    RAISE EXCEPTION 'links_not_allowed';
  END IF;

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
