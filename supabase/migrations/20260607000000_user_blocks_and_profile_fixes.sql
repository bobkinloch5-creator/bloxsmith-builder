-- =========================================================================
-- User Blocks — lets any authenticated user block another user.
-- Blocked users' chat messages are hidden client-side.
-- Also adds the missing RPC for blocking/unblocking.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own blocks
DROP POLICY IF EXISTS "users read own blocks" ON public.user_blocks;
CREATE POLICY "users read own blocks" ON public.user_blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);

-- Users can only block as themselves
DROP POLICY IF EXISTS "users insert own blocks" ON public.user_blocks;
CREATE POLICY "users insert own blocks" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

-- Users can only unblock their own blocks
DROP POLICY IF EXISTS "users delete own blocks" ON public.user_blocks;
CREATE POLICY "users delete own blocks" ON public.user_blocks
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- RPC: block a user
CREATE OR REPLACE FUNCTION public.block_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid = _target THEN RAISE EXCEPTION 'cannot block self'; END IF;
  INSERT INTO public.user_blocks(blocker_id, blocked_id)
  VALUES (_uid, _target)
  ON CONFLICT DO NOTHING;
  -- Also remove any friend relationship
  DELETE FROM public.friend_requests
  WHERE (requester_id = _uid AND addressee_id = _target)
     OR (requester_id = _target AND addressee_id = _uid);
  -- Also unfollow in both directions
  DELETE FROM public.user_follows
  WHERE (follower_id = _uid AND following_id = _target)
     OR (follower_id = _target AND following_id = _uid);
END $$;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- RPC: unblock a user
CREATE OR REPLACE FUNCTION public.unblock_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = _target;
END $$;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
