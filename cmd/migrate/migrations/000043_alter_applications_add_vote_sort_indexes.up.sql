-- The review queue sorts by vote tally, and the cursor pages on (votes, id) --
-- the same shape as idx_applications_created_at_id, which is why that sort has
-- always been cheap and these have not. Without them every page of the Reviews,
-- Grading and travel review screens sorts the whole table.
CREATE INDEX idx_applications_accept_votes
    ON applications (accept_votes DESC, id DESC);

CREATE INDEX idx_applications_reject_votes
    ON applications (reject_votes DESC, id DESC);

CREATE INDEX idx_applications_waitlist_votes
    ON applications (waitlist_votes DESC, id DESC);

CREATE INDEX idx_applications_travel_yes_votes
    ON applications (travel_yes_votes DESC, id DESC);
