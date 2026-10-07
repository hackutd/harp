-- A referral code seen at sign-in, held by email until the user row exists.
-- Magic links are often opened on another device, so the code can't wait in
-- the browser that clicked the referral link.
CREATE TABLE IF NOT EXISTS pending_referrals (
    email CITEXT PRIMARY KEY,
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_referrals_created_at ON pending_referrals(created_at);
