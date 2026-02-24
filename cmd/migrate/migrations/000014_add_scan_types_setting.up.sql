INSERT INTO settings (key, value)
VALUES ('scan_types', '[{"name": "check_in", "display_name": "Check In", "category": "check_in", "is_active": true}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
