DROP POLICY IF EXISTS "chat participants readable to signed in users" ON public.profiles;
CREATE POLICY "chat participants readable to signed in users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.global_chat_messages m
    WHERE m.user_id = profiles.id
      AND m.deleted_at IS NULL
  )
);