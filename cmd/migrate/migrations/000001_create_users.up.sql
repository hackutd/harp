CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('hacker', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supertokens_user_id TEXT UNIQUE NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'hacker',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
