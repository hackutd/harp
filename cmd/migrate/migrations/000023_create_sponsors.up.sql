CREATE TABLE sponsors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  tier          TEXT        NOT NULL DEFAULT 'standard',
  logo_path     TEXT,
  website_url   TEXT,
  description   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_sponsors
    BEFORE UPDATE ON sponsors FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();