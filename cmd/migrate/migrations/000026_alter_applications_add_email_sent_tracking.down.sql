DROP INDEX IF EXISTS idx_applications_announcement_email_pending;
DROP INDEX IF EXISTS idx_applications_decision_email_pending;

ALTER TABLE applications
    DROP COLUMN IF EXISTS announcement_email_sent_at,
    DROP COLUMN IF EXISTS decision_email_sent_at;
