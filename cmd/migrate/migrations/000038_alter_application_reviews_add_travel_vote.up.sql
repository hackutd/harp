-- Admin's yes/no travel reimbursement recommendation, recorded alongside the
-- main vote. NULL when the applicant did not request travel (or not voted yet).
ALTER TABLE application_reviews ADD COLUMN travel_vote BOOLEAN;
