ALTER TABLE attendee_directory_profiles ADD COLUMN IF NOT EXISTS headshot_path TEXT;

UPDATE attendee_directory_profiles p
SET headshot_path = u.photo_path
FROM users u
WHERE u.id = p.user_id
  AND u.photo_path IS NOT NULL;
