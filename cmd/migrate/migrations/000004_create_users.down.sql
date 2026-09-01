DROP INDEX IF EXISTS idx_users_email_trgm;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP TABLE IF EXISTS users;
