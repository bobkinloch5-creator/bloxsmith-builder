-- 1. Restrict profile SELECT to authenticated users (was {public})
DROP POLICY IF EXISTS "Profiles are public readable" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.profiles FROM anon;

-- 2. Enforce chat_channels.post_role on inserts into global_chat_messages
DROP POLICY IF EXISTS "channel-aware insert" ON public.global_chat_messages;
CREATE POLICY "channel-aware insert"
ON public.global_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_admin(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.slug = channel_id)
    OR EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.slug = channel_id
        AND (
          c.post_role = 'user'
          OR (c.post_role = 'moderator' AND public.has_role(auth.uid(), 'moderator'))
          OR (c.post_role = 'admin' AND public.is_admin(auth.uid()))
          OR (c.post_role = 'owner' AND public.has_role(auth.uid(), 'owner'))
        )
    )
  )
);

-- Also enforce view_role on reads
DROP POLICY IF EXISTS "channel-aware read" ON public.global_chat_messages;
CREATE POLICY "channel-aware read"
ON public.global_chat_messages
FOR SELECT
TO authenticated
USING (
  (deleted_at IS NULL OR public.is_admin(auth.uid()))
  AND (
    public.is_admin(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.slug = channel_id)
    OR EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.slug = channel_id
        AND (
          c.view_role = 'user'
          OR (c.view_role = 'moderator' AND public.has_role(auth.uid(), 'moderator'))
          OR (c.view_role = 'admin' AND public.is_admin(auth.uid()))
          OR (c.view_role = 'owner' AND public.has_role(auth.uid(), 'owner'))
        )
    )
  )
);

-- 3. Fix mutable search_path on email queue functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
