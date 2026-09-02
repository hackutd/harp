CREATE TABLE IF NOT EXISTS hacker_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'link',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_hacker_links_updated_at
BEFORE UPDATE ON hacker_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
