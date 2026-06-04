
DROP POLICY IF EXISTS "Profile media readable by authenticated" ON storage.objects;
CREATE POLICY "Profile media readable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-media');
