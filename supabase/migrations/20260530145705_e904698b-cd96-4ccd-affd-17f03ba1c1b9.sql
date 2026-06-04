
-- Add custom background URL field for user-uploaded animated backgrounds
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_background_url text,
  ADD CONSTRAINT profiles_custom_background_url_len CHECK (custom_background_url IS NULL OR char_length(custom_background_url) <= 1024);

-- Allow "custom" as a valid profile_background value (drop existing check if any then no-op since column has no check)
-- profile_background has no check constraint currently per inspection.

-- Storage bucket for profile media (avatars, banners, custom backgrounds incl. gifs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  15728640, -- 15MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/apng','video/mp4','video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "profile-media public read" ON storage.objects;
CREATE POLICY "profile-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-media');

-- Users can upload to their own folder: profile-media/{user_id}/...
DROP POLICY IF EXISTS "profile-media user insert" ON storage.objects;
CREATE POLICY "profile-media user insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile-media user update" ON storage.objects;
CREATE POLICY "profile-media user update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile-media user delete" ON storage.objects;
CREATE POLICY "profile-media user delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
