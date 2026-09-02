-- created_by cannot go back to NOT NULL while orphaned rows exist, and the
-- original author is unrecoverable, so those notifications are dropped.
DELETE FROM scheduled_notifications WHERE created_by IS NULL;

ALTER TABLE scheduled_notifications DROP CONSTRAINT IF EXISTS scheduled_notifications_created_by_fkey;

ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE scheduled_notifications ALTER COLUMN created_by SET NOT NULL;
