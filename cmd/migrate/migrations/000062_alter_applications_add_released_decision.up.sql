-- The decision a hacker can see: a copy of status, travel_status and the
-- approved amount, taken when a decision release covered the application.
-- NULL until the first release that covers it. Travel columns stay NULL while
-- the travel decision is undecided.
ALTER TABLE applications
    ADD COLUMN released_status application_status,
    ADD COLUMN released_travel_status travel_status,
    ADD COLUMN released_travel_amount_cents BIGINT,
    ADD COLUMN decision_release_id UUID REFERENCES decision_releases(id) ON DELETE SET NULL,
    ADD COLUMN decision_released_at TIMESTAMPTZ;

CREATE INDEX idx_applications_decision_release_id
    ON applications (decision_release_id);
