DO $$ BEGIN
    CREATE TYPE travel_status AS ENUM ('not_requested', 'pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
