DO $$ BEGIN
    CREATE TYPE directory_intent AS ENUM (
        'looking_for_teammates',
        'partial_team',
        'team_set',
        'open_to_collab',
        'just_networking'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

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

CREATE TRIGGER trg_attendee_directory_profiles_updated_at
BEFORE UPDATE ON attendee_directory_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS pokes (
    poker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poker_id, pokee_id),
    CHECK (poker_id <> pokee_id)
);

CREATE INDEX IF NOT EXISTS idx_pokes_pokee ON pokes (pokee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS directory_contacts (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, contact_id),
    CHECK (owner_id <> contact_id)
);

CREATE TABLE IF NOT EXISTS directory_hidden_profiles (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, hidden_id),
    CHECK (owner_id <> hidden_id)
);

INSERT INTO settings (key, value) VALUES ('directory_interest_tags', '[
    "AI/ML", "Web Dev", "Mobile", "Hardware", "Cybersecurity", "Data Science",
    "Game Dev", "Design", "FinTech", "HealthTech", "Sustainability", "EdTech",
    "Blockchain", "Robotics", "AR/VR", "Social Good"
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
