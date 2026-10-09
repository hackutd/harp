DROP INDEX IF EXISTS idx_applications_decision_release_id;

ALTER TABLE applications
    DROP COLUMN IF EXISTS decision_released_at,
    DROP COLUMN IF EXISTS decision_release_id,
    DROP COLUMN IF EXISTS released_travel_amount_cents,
    DROP COLUMN IF EXISTS released_travel_status,
    DROP COLUMN IF EXISTS released_status;
