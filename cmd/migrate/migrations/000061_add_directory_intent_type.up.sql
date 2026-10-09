DO $$ BEGIN
    CREATE TYPE directory_intent AS ENUM (
        'looking_for_teammates',
        'partial_team',
        'team_set',
        'open_to_collab',
        'just_networking'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
