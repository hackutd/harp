CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'standard',
    logo_data TEXT NOT NULL DEFAULT '',
    logo_content_type TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_sponsors_updated_at
BEFORE UPDATE ON sponsors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
