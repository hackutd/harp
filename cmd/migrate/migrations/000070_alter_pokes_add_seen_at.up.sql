-- When the pokee saw the poke, either on their "Poked you" list or by poking
-- back. Unseen pokes drive the badge on that tab.
ALTER TABLE pokes ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
