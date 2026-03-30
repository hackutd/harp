ALTER TABLE sponsors ADD COLUMN logo_data TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN logo_content_type TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors DROP COLUMN logo_path;
