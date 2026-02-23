INSERT INTO settings (key, value)
VALUES ('scan_stats', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
