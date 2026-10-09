-- Rolls back to before releases existed: every published decision and release
-- goes, not only the one this migration seeded.
UPDATE applications
SET released_status = NULL,
    released_travel_status = NULL,
    released_travel_amount_cents = NULL,
    decision_release_id = NULL,
    decision_released_at = NULL
WHERE decision_release_id IS NOT NULL OR released_status IS NOT NULL;

DELETE FROM decision_releases;
