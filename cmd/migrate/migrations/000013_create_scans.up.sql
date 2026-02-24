CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type TEXT NOT NULL,
    scanned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each hacker can only be scanned once per type
    UNIQUE(user_id, scan_type)
);

-- Fast aggregate: "how many people have claimed this type?"
CREATE INDEX IF NOT EXISTS idx_scans_scan_type
    ON scans(scan_type);
