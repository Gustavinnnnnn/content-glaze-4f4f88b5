
-- Drop broad public SELECT and replace with per-object public read (no LIST).
-- Public can read individual objects by URL; only admins can list.
DROP POLICY IF EXISTS "public read models bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read site bucket" ON storage.objects;

-- Public read individual objects (no listing — list requires owner column match which anon won't have)
CREATE POLICY "public read models objects" ON storage.objects FOR SELECT
  USING (bucket_id = 'models' AND (storage.foldername(name))[1] IS NOT NULL);
CREATE POLICY "public read videos objects" ON storage.objects FOR SELECT
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] IS NOT NULL);
CREATE POLICY "public read site objects" ON storage.objects FOR SELECT
  USING (bucket_id = 'site' AND (storage.foldername(name))[1] IS NOT NULL);
