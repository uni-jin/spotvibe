-- Allow admin (anon) to upload place thumbnails to post-images bucket
-- Admin uses custom JWT, not Supabase Auth, so uploads run as anon.
-- Restrict anon INSERT to path prefix 'places/' only (used by admin place thumbnails).

CREATE POLICY "Allow anon upload to places folder"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = 'places'
);
