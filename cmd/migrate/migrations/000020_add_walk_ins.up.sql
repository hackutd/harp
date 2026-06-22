CREATE TABLE walk_ins (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    queued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at TIMESTAMPTZ,
    promoted_by UUID        REFERENCES users(id) ON DELETE SET NULL
);

-- FIFO index: un-promoted rows first (promoted_at NULLS FIRST), then arrival order
CREATE INDEX idx_walk_ins_fifo ON walk_ins (promoted_at NULLS FIRST, queued_at ASC);
