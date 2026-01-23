DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;

DROP TABLE IF EXISTS applications;

DO $$ BEGIN
    DROP TYPE IF EXISTS dietary_restriction;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS application_status;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;