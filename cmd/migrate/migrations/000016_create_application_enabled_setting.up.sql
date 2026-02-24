INSERT INTO settings (key, value) VALUES ('application_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
