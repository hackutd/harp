-- Add review_assignment_enabled column to users table
-- Defaults to true for existing admins so review assignment continues to work
ALTER TABLE users
ADD COLUMN review_assignment_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop the global settings row as it's now per-admin
DELETE FROM settings WHERE key = 'review_assignment_enabled';
