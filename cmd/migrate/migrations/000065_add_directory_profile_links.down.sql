ALTER TABLE attendee_directory_profiles
    DROP COLUMN IF EXISTS experiences,
    DROP COLUMN IF EXISTS linkedin_handle,
    DROP COLUMN IF EXISTS github_username;
