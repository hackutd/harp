-- Travel RSVP: proof-of-travel form filled out by hackers whose travel
-- reimbursement was approved. Reuses the rsvp_status enum (pending/confirmed/declined).
ALTER TABLE applications ADD COLUMN travel_rsvp_status rsvp_status NOT NULL DEFAULT 'pending';

-- Answers to the configurable travel RSVP form, keyed by field id from the travel_rsvp_schema setting
ALTER TABLE applications ADD COLUMN travel_rsvp_responses JSONB NOT NULL DEFAULT '{}';

ALTER TABLE applications ADD COLUMN travel_rsvp_submitted_at TIMESTAMPTZ;

-- GCS object paths of uploaded receipt files (plane tickets etc.), max enforced in the handler
ALTER TABLE applications ADD COLUMN travel_receipt_paths TEXT[] NOT NULL DEFAULT '{}';
