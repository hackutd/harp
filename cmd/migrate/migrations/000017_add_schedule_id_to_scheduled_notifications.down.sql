DROP INDEX IF EXISTS idx_scheduled_notifications_schedule_id;

ALTER TABLE scheduled_notifications
    DROP COLUMN IF EXISTS schedule_id;
