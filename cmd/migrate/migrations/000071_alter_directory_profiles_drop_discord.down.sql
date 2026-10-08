ALTER TABLE attendee_directory_profiles
    ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
    ADD COLUMN IF NOT EXISTS discord_username TEXT;
