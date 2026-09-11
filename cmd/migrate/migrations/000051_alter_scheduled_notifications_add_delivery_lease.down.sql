DROP INDEX IF EXISTS idx_scheduled_notifications_claimable;

ALTER TABLE scheduled_notifications
    DROP COLUMN IF EXISTS claimed_at,
    DROP COLUMN IF EXISTS attempts,
    DROP COLUMN IF EXISTS failed_at,
    DROP COLUMN IF EXISTS last_error;
