-- Directory cards now show the user's profile photo, so card headshots move
-- onto the user and the card column goes away.
UPDATE users u
SET photo_path = p.headshot_path
FROM attendee_directory_profiles p
WHERE p.user_id = u.id
  AND p.headshot_path IS NOT NULL
  AND u.photo_path IS NULL;

ALTER TABLE attendee_directory_profiles DROP COLUMN IF EXISTS headshot_path;
