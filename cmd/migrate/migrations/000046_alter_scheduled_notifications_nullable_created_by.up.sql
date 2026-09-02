-- created_by was ON DELETE RESTRICT, so deleting any staff account that had ever
-- scheduled a notification failed outright. Keep the notification, including its
-- send history, and drop only the attribution.
ALTER TABLE scheduled_notifications ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE scheduled_notifications DROP CONSTRAINT IF EXISTS scheduled_notifications_created_by_fkey;

ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
