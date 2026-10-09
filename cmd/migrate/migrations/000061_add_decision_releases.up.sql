-- A decision release (a "wave") publishes the current decisions of one group of
-- applicants. Hackers see only what a release published, so a decision changed
-- afterwards stays hidden until a later release covers it.
CREATE TABLE IF NOT EXISTS decision_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    released_by UUID REFERENCES users(id) ON DELETE SET NULL,
    audience TEXT NOT NULL CHECK (audience IN ('priority', 'non_priority', 'everyone')),
    statuses application_status[] NOT NULL,
    -- The priority deadline the audience was resolved against, kept for the
    -- record since the setting can change later.
    priority_deadline TIMESTAMPTZ,
    released_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    undone_at TIMESTAMPTZ,
    undone_by UUID REFERENCES users(id) ON DELETE SET NULL
);
