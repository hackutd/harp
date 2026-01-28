DROP INDEX IF EXISTS idx_applications_reviews_completed;

ALTER TABLE applications
    DROP COLUMN IF EXISTS accept_votes,
    DROP COLUMN IF EXISTS reject_votes,
    DROP COLUMN IF EXISTS waitlist_votes,
    DROP COLUMN IF EXISTS reviews_assigned,
    DROP COLUMN IF EXISTS reviews_completed;
