-- Remove review_assignment_enabled column from users table
ALTER TABLE users
DROP COLUMN review_assignment_enabled;

-- Restore the global setting
INSERT INTO settings (key, value)
VALUES ('review_assignment_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
