DROP INDEX IF EXISTS idx_users_referral_id;
ALTER TABLE users DROP COLUMN IF EXISTS referral_id;
