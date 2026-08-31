-- Travel reimbursement review state. Set to 'pending' at submit time when the
-- applicant opted in via the travel_reimbursement response field, then decided
-- by a super admin ('approved'/'rejected') independently of application status.
ALTER TABLE applications ADD COLUMN travel_status travel_status NOT NULL DEFAULT 'not_requested';

-- Denormalized tallies of admin travel votes, maintained by the vote count trigger
ALTER TABLE applications ADD COLUMN travel_yes_votes INT NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN travel_no_votes INT NOT NULL DEFAULT 0;
