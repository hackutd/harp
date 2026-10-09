-- One row per application a release changed: what it published, and what the
-- applicant could see before, so the most recent release can be undone.
CREATE TABLE IF NOT EXISTS decision_release_items (
    release_id UUID NOT NULL REFERENCES decision_releases(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status application_status NOT NULL,
    travel_status travel_status,
    travel_amount_cents BIGINT,
    previous_status application_status,
    previous_travel_status travel_status,
    previous_travel_amount_cents BIGINT,
    previous_release_id UUID REFERENCES decision_releases(id) ON DELETE SET NULL,
    previous_released_at TIMESTAMPTZ,
    -- A release that changes a decision clears the email markers so the new
    -- decision gets its own email; undo puts them back.
    previous_decision_email_sent_at TIMESTAMPTZ,
    previous_announcement_email_sent_at TIMESTAMPTZ,
    PRIMARY KEY (release_id, application_id)
);

CREATE INDEX idx_decision_release_items_application_id
    ON decision_release_items (application_id);
