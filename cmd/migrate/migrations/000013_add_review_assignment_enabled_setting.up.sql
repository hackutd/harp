INSERT INTO settings (key, value)
VALUES ('review_assignment_enabled', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
