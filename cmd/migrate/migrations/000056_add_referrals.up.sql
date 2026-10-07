-- Influencer and ad referral links. A link is /?s=<code>; the code is random
-- by default so applicants can't tell who sent them. CITEXT keeps a hand-typed
-- code from colliding with one that differs only in case.
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code CITEXT NOT NULL UNIQUE,
    visit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_referrals_updated_at
BEFORE UPDATE ON referrals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
