INSERT INTO settings (key, value) VALUES ('event_start_date', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
