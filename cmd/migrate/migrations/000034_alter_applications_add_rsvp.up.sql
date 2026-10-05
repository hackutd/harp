-- RSVP state for accepted hackers claiming their spot
ALTER TABLE applications ADD COLUMN rsvp_status rsvp_status NOT NULL DEFAULT 'pending';

-- Answers to the configurable RSVP form, keyed by field id from the rsvp_schema setting
ALTER TABLE applications ADD COLUMN rsvp_responses JSONB NOT NULL DEFAULT '{}';

ALTER TABLE applications ADD COLUMN rsvp_submitted_at TIMESTAMPTZ;
