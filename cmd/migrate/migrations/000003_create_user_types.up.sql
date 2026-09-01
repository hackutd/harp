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
