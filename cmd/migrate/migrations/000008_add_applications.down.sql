DROP INDEX IF EXISTS idx_applications_responses;
DROP INDEX IF EXISTS idx_applications_reviews_completed;
DROP INDEX IF EXISTS idx_applications_created_at_id;
DROP INDEX IF EXISTS idx_applications_submitted_at;
DROP INDEX IF EXISTS idx_applications_status;

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
DROP TABLE IF EXISTS applications;
