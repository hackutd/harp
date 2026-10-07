-- The referral link a user signed up through, set once when the user row is
-- created. Deleting a referral forgets the attribution rather than the user.
ALTER TABLE users
    ADD COLUMN referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL;

CREATE INDEX idx_users_referral_id ON users(referral_id) WHERE referral_id IS NOT NULL;
