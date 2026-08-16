-- Hackathon identity and key dates, configured by super admins through the
-- onboarding form instead of environment variables.
INSERT INTO settings (key, value) VALUES ('hackathon_name', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('contact_email', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('from_email', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('from_name', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('application_due_date', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('decision_release_date', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('event_start_date', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
