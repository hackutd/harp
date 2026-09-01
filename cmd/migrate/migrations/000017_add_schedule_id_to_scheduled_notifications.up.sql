ALTER TABLE scheduled_notifications
    ADD COLUMN schedule_id UUID REFERENCES schedule(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_schedule_id
    ON scheduled_notifications(schedule_id) WHERE schedule_id IS NOT NULL;
