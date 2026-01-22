DO $$ BEGIN
    CREATE TYPE auth_method AS ENUM ('passwordless', 'google');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method auth_method NOT NULL DEFAULT 'passwordless';
