ALTER TABLE applications
    ADD COLUMN decision_email_sent_at TIMESTAMPTZ,
    ADD COLUMN announcement_email_sent_at TIMESTAMPTZ;

-- Partial indexes back the "who still needs an email" lookups driven by the
-- super admin Send Emails dialog.
CREATE INDEX idx_applications_decision_email_pending
    ON applications (status)
    WHERE decision_email_sent_at IS NULL;

CREATE INDEX idx_applications_announcement_email_pending
    ON applications (status)
    WHERE announcement_email_sent_at IS NULL;
