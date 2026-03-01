CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_applications_first_name_trgm ON applications USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_applications_last_name_trgm ON applications USING gin (last_name gin_trgm_ops);
