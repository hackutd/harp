-- sent_at used to be written at claim time, so it meant "a dispatcher saw this row",
-- not "hackers were notified": any interruption between the claim and the actual push
-- dropped the notification permanently. Split that into a revocable lease (claimed_at)
-- and a real delivery record (sent_at), with a terminal failed_at for the giving-up case.
-- Rows already marked sent cannot be reclassified retroactively and are left alone.
ALTER TABLE scheduled_notifications
    ADD COLUMN claimed_at TIMESTAMPTZ,
    ADD COLUMN attempts   INT NOT NULL DEFAULT 0,
    ADD COLUMN failed_at  TIMESTAMPTZ,
    ADD COLUMN last_error TEXT;

-- idx_scheduled_notifications_pending (000016) stays: Update and GenerateFromSchedule
-- still query on bare sent_at IS NULL, which does not imply this narrower predicate.
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_claimable
    ON scheduled_notifications(scheduled_at)
    WHERE sent_at IS NULL AND failed_at IS NULL;
