-- Kickoff is the hackathon start date, so it is no longer configured separately.
DELETE FROM settings WHERE key = 'event_start_date';
