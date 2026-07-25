-- Shop purchases may repeat per user; all other scan types stay once-per-user.
ALTER TABLE scans ADD COLUMN repeatable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE scans DROP CONSTRAINT scans_user_id_scan_type_key;

CREATE UNIQUE INDEX uq_scans_user_scan_type_once ON scans(user_id, scan_type) WHERE NOT repeatable;

-- Replaces the per-user lookup role of the dropped unique constraint's index
-- (balance SUMs and check-in existence checks).
CREATE INDEX idx_scans_user_id ON scans(user_id);
