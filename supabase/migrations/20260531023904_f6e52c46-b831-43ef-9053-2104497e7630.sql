
-- 1. Restrict global_chat_reactions SELECT to authenticated users only
DROP POLICY IF EXISTS "reactions readable" ON public.global_chat_reactions;
CREATE POLICY "reactions readable to authed"
ON public.global_chat_reactions
FOR SELECT
TO authenticated
USING (true);

-- 2. Restrict global_chat_user_prefs SELECT to own row (admins via has_role)
DROP POLICY IF EXISTS "prefs read" ON public.global_chat_user_prefs;
CREATE POLICY "prefs read own"
ON public.global_chat_user_prefs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 3. Owner-scoped storage policies for generated-3d-models bucket
DROP POLICY IF EXISTS "Users can upload own 3d models" ON storage.objects;
CREATE POLICY "Users can upload own 3d models"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-3d-models'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own 3d models" ON storage.objects;
CREATE POLICY "Users can update own 3d models"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-3d-models'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'generated-3d-models'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own 3d models" ON storage.objects;
CREATE POLICY "Users can delete own 3d models"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-3d-models'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
