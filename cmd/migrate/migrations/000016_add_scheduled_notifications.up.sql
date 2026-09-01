CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    target_role user_role,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    recipient_count INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
    ON scheduled_notifications(scheduled_at) WHERE sent_at IS NULL;

CREATE TRIGGER trg_scheduled_notifications_updated_at
BEFORE UPDATE ON scheduled_notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
