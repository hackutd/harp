INSERT INTO settings (key, value)
VALUES ('review_assignment_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
