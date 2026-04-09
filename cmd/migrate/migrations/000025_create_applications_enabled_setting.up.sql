INSERT INTO settings (key, value) VALUES ('applications_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
