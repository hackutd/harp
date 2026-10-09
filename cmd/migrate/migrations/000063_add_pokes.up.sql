CREATE TABLE IF NOT EXISTS pokes (
    poker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- When the pokee saw the poke, either on their "Poked you" list or by
    -- poking back. Unseen pokes drive the badge on that tab.
    seen_at TIMESTAMPTZ,
    PRIMARY KEY (poker_id, pokee_id),
    CHECK (poker_id <> pokee_id)
);

CREATE INDEX IF NOT EXISTS idx_pokes_pokee ON pokes (pokee_id, created_at DESC);
