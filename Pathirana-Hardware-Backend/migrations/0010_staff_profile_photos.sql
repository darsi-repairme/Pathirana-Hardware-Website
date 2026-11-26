-- Staff profile photos (Admin and Editor accounts).
--
-- ADDITIVE: two OPTIONAL columns on staff (NULL for every existing account). No existing row,
-- credential, role or password changes. The image itself is NOT stored in the database: photo_key
-- names two server-generated WebP files (<uuid>.webp, <uuid>-thumb.webp) in the PRIVATE media
-- storage area "staff" (local UPLOAD_DIR or the private Supabase catalogue bucket, path staff/…).
-- Photos are only ever served by the API to signed-in staff (the owner of the photo, or an admin).
--
-- Rollback (after removing any staff/* objects from storage if desired):
--   DROP INDEX staff_photo_key;
--   ALTER TABLE staff DROP COLUMN photo_updated_at, DROP COLUMN photo_key;
--   DELETE FROM schema_migrations WHERE version = '0010_staff_profile_photos.sql';

ALTER TABLE staff
  ADD COLUMN photo_key        text CHECK (photo_key IS NULL OR photo_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  ADD COLUMN photo_updated_at timestamptz;

CREATE UNIQUE INDEX staff_photo_key ON staff (photo_key) WHERE photo_key IS NOT NULL;
