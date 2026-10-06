-- Hackers only see final decisions once a super admin releases them.
INSERT INTO settings (key, value) VALUES ('decisions_released', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
