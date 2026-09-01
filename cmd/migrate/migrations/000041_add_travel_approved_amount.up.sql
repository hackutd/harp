-- The amount an organizer actually commits can differ from the estimate the
-- applicant requested. NULL preserves legacy approvals that predate explicit
-- award amounts and lets the UI flag them for follow-up.
ALTER TABLE applications
ADD COLUMN travel_approved_amount_cents BIGINT
CHECK (travel_approved_amount_cents IS NULL OR travel_approved_amount_cents > 0);
