-- status for app lifecycle
DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'waitlisted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE dietary_restriction AS ENUM (
        'vegan',
        'vegetarian',
        'halal',
        'nuts',
        'fish',
        'wheat',
        'dairy',
        'eggs',
        'no_beef',
        'no_pork'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'draft',

    first_name VARCHAR(255),
    last_name  VARCHAR(255),
    phone_e164 TEXT,
    age SMALLINT,

    country_of_residence VARCHAR(255),
    gender VARCHAR(255),
    race VARCHAR(255),
    ethnicity VARCHAR(255),

    university VARCHAR(255),
    major VARCHAR(255),
    level_of_study VARCHAR(255),

    why_attend TEXT,
    hackathons_learned TEXT,
    first_hackathon_goals TEXT,
    looking_forward TEXT,

    github VARCHAR(255),
    linkedin VARCHAR(255),
    website VARCHAR(255),

    hackathons_attended_count SMALLINT,
    software_experience_level VARCHAR(255),
    heard_about VARCHAR(255),

    shirt_size VARCHAR(255),
    dietary_restrictions dietary_restriction[] NOT NULL DEFAULT '{}'::dietary_restriction[],
    accommodations TEXT,

    ack_application BOOLEAN NOT NULL DEFAULT FALSE,
    ack_mlh_coc BOOLEAN NOT NULL DEFAULT FALSE,
    ack_mlh_privacy BOOLEAN NOT NULL DEFAULT FALSE,
    opt_in_mlh_emails BOOLEAN NOT NULL DEFAULT FALSE,

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT applications_age_check CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
    CONSTRAINT applications_phone_check CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{1,14}$'),
    CONSTRAINT applications_submitted_check CHECK (
        status <> 'submitted'
        OR (submitted_at IS NOT NULL AND ack_application AND ack_mlh_coc AND ack_mlh_privacy)
    )
);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications (submitted_at DESC);
