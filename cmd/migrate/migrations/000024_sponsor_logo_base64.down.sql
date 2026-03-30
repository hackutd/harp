ALTER TABLE sponsors ADD COLUMN logo_path TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors DROP COLUMN logo_data;
ALTER TABLE sponsors DROP COLUMN logo_content_type;
