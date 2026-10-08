-- Discord account linking was removed; matches see the RSVP Discord username.
ALTER TABLE attendee_directory_profiles
    DROP COLUMN IF EXISTS discord_user_id,
    DROP COLUMN IF EXISTS discord_username;
