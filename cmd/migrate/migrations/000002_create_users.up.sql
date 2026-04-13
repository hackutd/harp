DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('hacker', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE auth_method AS ENUM ('passwordless', 'google');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supertokens_user_id TEXT UNIQUE NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'hacker',
    auth_method auth_method NOT NULL DEFAULT 'passwordless',
    profile_picture_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
