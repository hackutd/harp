ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS accept_votes INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reject_votes INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS waitlist_votes INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviews_assigned INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviews_completed INT NOT NULL DEFAULT 0;

-- Index for filtering applications by review status
CREATE INDEX IF NOT EXISTS idx_applications_reviews_completed
    ON applications(reviews_completed);
