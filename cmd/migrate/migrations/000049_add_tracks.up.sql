CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    sponsor_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    prizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    logo_data TEXT NOT NULL DEFAULT '',
    logo_content_type TEXT NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tracks_updated_at
BEFORE UPDATE ON tracks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
