-- Decisions already released under the old all-or-nothing decisions_released
-- toggle become one release covering every decided application, so nobody's
-- view changes. Nothing happens when the toggle was off.
WITH legacy AS (
    INSERT INTO decision_releases (audience, statuses)
    SELECT 'everyone', ARRAY['accepted', 'waitlisted', 'rejected']::application_status[]
    FROM settings
    WHERE key = 'decisions_released' AND value = 'true'::jsonb
    RETURNING id
), released AS (
    UPDATE applications a
    SET released_status = a.status,
        released_travel_status = CASE WHEN a.travel_status IN ('approved', 'rejected') THEN a.travel_status END,
        released_travel_amount_cents = CASE WHEN a.travel_status = 'approved' THEN a.travel_approved_amount_cents END,
        decision_release_id = legacy.id,
        decision_released_at = now()
    FROM legacy
    WHERE a.status IN ('accepted', 'waitlisted', 'rejected')
    RETURNING legacy.id AS release_id, a.id, a.released_status, a.released_travel_status,
              a.released_travel_amount_cents, a.decision_email_sent_at, a.announcement_email_sent_at
)
INSERT INTO decision_release_items (
    release_id, application_id, status, travel_status, travel_amount_cents,
    previous_decision_email_sent_at, previous_announcement_email_sent_at
)
SELECT release_id, id, released_status, released_travel_status, released_travel_amount_cents,
       decision_email_sent_at, announcement_email_sent_at
FROM released;

UPDATE decision_releases r
SET released_count = (SELECT count(*) FROM decision_release_items i WHERE i.release_id = r.id);
