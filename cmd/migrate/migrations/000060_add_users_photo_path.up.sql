-- An uploaded profile photo. It replaces the Google picture everywhere the
-- user appears (profile, sidebar); NULL falls back to it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path TEXT;
