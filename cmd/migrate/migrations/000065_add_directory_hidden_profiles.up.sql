CREATE TABLE IF NOT EXISTS directory_hidden_profiles (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, hidden_id),
    CHECK (owner_id <> hidden_id)
);
