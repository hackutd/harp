CREATE TABLE IF NOT EXISTS attendee_directory_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
    pronouns TEXT CHECK (char_length(pronouns) <= 30),
    headshot_path TEXT,
    skills TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 3),
    interest_tags TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(interest_tags) <= 5),
    roles_looking_for TEXT[] NOT NULL DEFAULT '{}',
    icebreaker_prompt TEXT CHECK (char_length(icebreaker_prompt) <= 120),
    icebreaker_answer TEXT CHECK (char_length(icebreaker_answer) <= 200),
    want_to_build TEXT CHECK (char_length(want_to_build) <= 100),
    intent directory_intent NOT NULL,
    spots_needed SMALLINT CHECK (spots_needed BETWEEN 1 AND 5),
    discoverable BOOLEAN NOT NULL DEFAULT TRUE,
    status_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discord_user_id TEXT,
    discord_username TEXT,
    moderation_hidden_at TIMESTAMPTZ,
    moderation_hidden_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT directory_spots_only_partial CHECK (
        (intent = 'partial_team' AND spots_needed IS NOT NULL)
        OR (intent <> 'partial_team' AND spots_needed IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_directory_profiles_browse
    ON attendee_directory_profiles (status_confirmed_at DESC, user_id)
    WHERE discoverable AND moderation_hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_directory_profiles_created
    ON attendee_directory_profiles (created_at DESC, user_id);

CREATE TRIGGER trg_attendee_directory_profiles_updated_at
BEFORE UPDATE ON attendee_directory_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
