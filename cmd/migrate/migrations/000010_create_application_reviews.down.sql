DROP INDEX IF EXISTS idx_reviews_app_completed;
DROP INDEX IF EXISTS idx_reviews_admin_pending;
DROP INDEX IF EXISTS idx_reviews_admin_id;
DROP INDEX IF EXISTS idx_reviews_application_id;

DROP TRIGGER IF EXISTS trg_application_reviews_updated_at ON application_reviews;

DROP TABLE IF EXISTS application_reviews;

DO $$ BEGIN
    DROP TYPE IF EXISTS review_vote;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;
