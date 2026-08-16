INSERT INTO settings (key, value) VALUES ('points_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
