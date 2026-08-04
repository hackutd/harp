INSERT INTO settings (key, value) VALUES ('points_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
