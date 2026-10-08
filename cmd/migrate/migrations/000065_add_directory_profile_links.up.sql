-- Public links and past roles shown on an attendee directory card. Links are
-- stored as handles, not URLs, so a card can only ever point at GitHub or
-- LinkedIn.
ALTER TABLE attendee_directory_profiles
    ADD COLUMN IF NOT EXISTS github_username TEXT CHECK (char_length(github_username) <= 39),
    ADD COLUMN IF NOT EXISTS linkedin_handle TEXT CHECK (char_length(linkedin_handle) <= 100),
    ADD COLUMN IF NOT EXISTS experiences JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(experiences) = 'array' AND jsonb_array_length(experiences) <= 3);
