DO $$ BEGIN
    CREATE TYPE review_vote AS ENUM ('accept', 'reject', 'waitlist');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
