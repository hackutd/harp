DO $$ BEGIN
    CREATE TYPE rsvp_status AS ENUM ('pending', 'confirmed', 'declined');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
