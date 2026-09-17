-- Links to the operator's own Terms of Service and Privacy Policy. The login
-- page asserts that hackers agree to both, so it must be able to link them.
-- These are per-deployment documents owned by whoever runs the event, not by
-- Harp, which is why they are settings rather than anything in the codebase.
INSERT INTO settings (key, value) VALUES ('privacy_policy_url', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('terms_url', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
