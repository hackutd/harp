DROP INDEX IF EXISTS idx_applications_last_name_trgm;
DROP INDEX IF EXISTS idx_applications_first_name_trgm;
DROP INDEX IF EXISTS idx_users_email_trgm;

DROP EXTENSION IF EXISTS pg_trgm;
