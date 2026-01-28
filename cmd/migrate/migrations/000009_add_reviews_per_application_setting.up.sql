INSERT INTO settings (key, value) VALUES ('reviews_per_application', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;
