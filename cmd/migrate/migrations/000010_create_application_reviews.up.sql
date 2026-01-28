DO $$ BEGIN
    CREATE TYPE review_vote AS ENUM ('accept', 'reject', 'waitlist');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS application_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote review_vote,
    notes TEXT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each admin can only be assigned once per application
    UNIQUE(application_id, admin_id),

    -- Check vote and reviewed at are both set
    CONSTRAINT vote_requires_reviewed_at CHECK (
        (vote IS NULL AND reviewed_at IS NULL) OR
        (vote IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

DROP TRIGGER IF EXISTS trg_application_reviews_updated_at ON application_reviews;
CREATE TRIGGER trg_application_reviews_updated_at
BEFORE UPDATE ON application_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_application_id
    ON application_reviews(application_id);

CREATE INDEX IF NOT EXISTS idx_reviews_admin_id
    ON application_reviews(admin_id);

-- Fast lookup for admin pending reviews
CREATE INDEX IF NOT EXISTS idx_reviews_admin_pending
    ON application_reviews(admin_id)
    WHERE vote IS NULL;

-- Fast count of completed reviews per application
CREATE INDEX IF NOT EXISTS idx_reviews_app_completed
    ON application_reviews(application_id)
    WHERE vote IS NOT NULL;
