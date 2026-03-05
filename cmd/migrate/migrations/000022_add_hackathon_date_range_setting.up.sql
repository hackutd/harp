INSERT INTO settings (key, value)
VALUES ('hackathon_date_range', '{"start_date": null, "end_date": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
