
DROP POLICY IF EXISTS "profile media readable by authenticated" ON storage.objects;
CREATE POLICY "profile media readable by authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-media');
