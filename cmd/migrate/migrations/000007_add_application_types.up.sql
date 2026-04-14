DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'waitlisted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
