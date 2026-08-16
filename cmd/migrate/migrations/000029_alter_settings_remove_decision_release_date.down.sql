INSERT INTO settings (key, value) VALUES ('decision_release_date', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
