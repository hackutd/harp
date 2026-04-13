DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'waitlisted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'draft',

    -- All form answers keyed by field id from application_schema setting
    responses JSONB NOT NULL DEFAULT '{}',

    -- Resume file path (stored separately since it's a file reference, not a form field)
    resume_path TEXT,

    -- AI detection percentage (set by admin tooling, not by the applicant)
    ai_percent SMALLINT,

    -- MLH acknowledgements (always required for submission, not configurable)
    ack_mlh_coc BOOLEAN NOT NULL DEFAULT FALSE,
    ack_mlh_privacy BOOLEAN NOT NULL DEFAULT FALSE,
    opt_in_mlh_emails BOOLEAN NOT NULL DEFAULT FALSE,

    -- Review vote counts (denormalized, maintained by trigger on application_reviews)
    accept_votes INT NOT NULL DEFAULT 0,
    reject_votes INT NOT NULL DEFAULT 0,
    waitlist_votes INT NOT NULL DEFAULT 0,
    reviews_assigned INT NOT NULL DEFAULT 0,
    reviews_completed INT NOT NULL DEFAULT 0,

    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT applications_ai_percent_check CHECK (ai_percent IS NULL OR (ai_percent >= 0 AND ai_percent <= 100)),
    CONSTRAINT applications_submitted_check CHECK (
        status <> 'submitted'
        OR (submitted_at IS NOT NULL AND ack_mlh_coc AND ack_mlh_privacy)
    )
);

CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_applications_status ON applications (status);
CREATE INDEX idx_applications_submitted_at ON applications (submitted_at DESC);
CREATE INDEX idx_applications_created_at_id ON applications (created_at DESC, id DESC);
CREATE INDEX idx_applications_reviews_completed ON applications (reviews_completed);

-- GIN index for querying inside responses JSONB (e.g. filtering by university, name search)
CREATE INDEX idx_applications_responses ON applications USING gin (responses jsonb_path_ops);
