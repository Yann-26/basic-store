-- =============================================================================
-- THE RISING STAR — storage lockdown (security finding TRS-C1)
--   The legacy "Admin can upload/update/delete" policies let ANY Supabase Auth
--   user (auth.role() = 'authenticated') write to the products, hero and avatars
--   buckets — and Supabase Auth sign-up is reachable with the public anon key.
--   The app never uses Supabase Auth nor uploads from the browser: every upload
--   goes through the API with the service role (which bypasses these policies).
--   → Drop the write policies: only the API can write.
--   Public buckets stay readable through their public URLs (no SELECT policy
--   needed for that); the listing policies are removed too (no file listing).
--   The settings bucket gets the same type and size limits as the others.
-- Idempotent.
-- NOTE: storage.objects is owned by supabase_storage_admin. The bucket UPDATEs
--   below were applied on 2026-10-02; the DROP POLICY statements must be run
--   from the Supabase Dashboard (Storage → Policies, or the SQL editor) because
--   the migration role is not the table owner. Also disable Supabase Auth
--   sign-ups (Authentication → Sign In / Providers): the app does not use it.
-- =============================================================================

drop policy if exists "Admin can upload" on storage.objects;
drop policy if exists "Admin can update" on storage.objects;
drop policy if exists "Admin can delete" on storage.objects;
drop policy if exists "Public can view avatars" on storage.objects;
drop policy if exists "Public can view hero" on storage.objects;

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'settings';

-- hero also holds newsletter visuals and videos (admin uploads through the API)
update storage.buckets
   set file_size_limit = 104857600,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'hero';

-- products: the API accepts videos up to 100 MB (images 10 MB); align the bucket.
update storage.buckets
   set file_size_limit = 104857600,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'products';
