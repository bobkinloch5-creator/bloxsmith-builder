-- 1. Channels table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text,
  view_role text NOT NULL DEFAULT 'user',   -- 'user' | 'admin' | 'owner'
  post_role text NOT NULL DEFAULT 'user',
  position int NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channels visible to authed" ON public.chat_channels;
CREATE POLICY "channels visible to authed" ON public.chat_channels
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "channels managed by admin" ON public.chat_channels;
CREATE POLICY "channels managed by admin" ON public.chat_channels
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2. Seed channels
INSERT INTO public.chat_channels (slug, name, description, view_role, post_role, position, icon) VALUES
  ('general',       'general',       'Hang out and chat with everyone',           'user',  'user',  0, 'hash'),
  ('announcements', 'announcements', 'Official updates from the BloxSmith team',  'user',  'admin', 1, 'megaphone'),
  ('help',          'help',          'Ask questions and get help from the community', 'user', 'user', 2, 'life-buoy'),
  ('staff',         'staff',         'Private channel for staff only',            'admin', 'admin', 3, 'shield')
ON CONFLICT (slug) DO NOTHING;

-- 3. Channel column on messages
ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS channel_id text NOT NULL DEFAULT 'general' REFERENCES public.chat_channels(slug);
CREATE INDEX IF NOT EXISTS idx_global_chat_messages_channel ON public.global_chat_messages (channel_id, created_at DESC);

-- 4. Permission helpers
CREATE OR REPLACE FUNCTION public.can_view_channel(_slug text, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE c.view_role
      WHEN 'user'  THEN _uid IS NOT NULL
      WHEN 'admin' THEN public.is_admin(_uid)
      WHEN 'owner' THEN public.has_role(_uid, 'owner')
      ELSE false
    END
    FROM public.chat_channels c WHERE c.slug = _slug
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_post_channel(_slug text, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE c.post_role
      WHEN 'user'  THEN _uid IS NOT NULL
      WHEN 'admin' THEN public.is_admin(_uid)
      WHEN 'owner' THEN public.has_role(_uid, 'owner')
      ELSE false
    END
    FROM public.chat_channels c WHERE c.slug = _slug
  ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_channel(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_post_channel(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_channel(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_post_channel(text, uuid) TO authenticated, service_role;

-- 5. Tighten message SELECT to enforce channel view rules
DROP POLICY IF EXISTS "auth read non-deleted" ON public.global_chat_messages;
DROP POLICY IF EXISTS "channel-aware read" ON public.global_chat_messages;
CREATE POLICY "channel-aware read" ON public.global_chat_messages
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_admin(auth.uid()))
    AND public.can_view_channel(channel_id, auth.uid())
  );

DROP POLICY IF EXISTS "channel-aware insert" ON public.global_chat_messages;
CREATE POLICY "channel-aware insert" ON public.global_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_post_channel(channel_id, auth.uid())
  );

DROP POLICY IF EXISTS "authors edit own" ON public.global_chat_messages;
CREATE POLICY "authors edit own" ON public.global_chat_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 6. Friendship helper
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b AND EXISTS (
    SELECT 1 FROM public.friend_requests f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

-- 7. Tighten DM insert: only friends or staff
DROP POLICY IF EXISTS "users send own dm" ON public.direct_messages;
CREATE POLICY "friends-only dm send" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.are_friends(sender_id, recipient_id)
      OR public.is_admin(auth.uid())
    )
  );

-- 8. RPCs for friends
CREATE OR REPLACE FUNCTION public.send_friend_request(_target uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target IS NULL OR _target = _uid THEN RAISE EXCEPTION 'invalid_target'; END IF;
  -- If reverse pending exists -> auto accept
  UPDATE public.friend_requests
     SET status = 'accepted', updated_at = now()
   WHERE requester_id = _target AND addressee_id = _uid AND status = 'pending'
   RETURNING id INTO _id;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.friend_requests(requester_id, addressee_id, status)
  VALUES (_uid, _target, 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.friend_requests
     WHERE requester_id = _uid AND addressee_id = _target;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.friend_requests
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,
         updated_at = now()
   WHERE id = _id AND addressee_id = _uid AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_friend(_other uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.friend_requests
   WHERE (requester_id = _uid AND addressee_id = _other)
      OR (requester_id = _other AND addressee_id = _uid);
END $$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;

-- 9. Allow profile reads for accepted friends so DMs/friends list can resolve names
DROP POLICY IF EXISTS "friends read each other profile" ON public.profiles;
CREATE POLICY "friends read each other profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), id));

-- 10. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;