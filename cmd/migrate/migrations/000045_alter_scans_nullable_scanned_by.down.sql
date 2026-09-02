-- scanned_by cannot go back to NOT NULL while orphaned rows exist, and there is
-- no way to recover who performed those scans, so they are dropped.
DELETE FROM scans WHERE scanned_by IS NULL;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scanned_by_fkey;

ALTER TABLE scans ADD CONSTRAINT scans_scanned_by_fkey
    FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE scans ALTER COLUMN scanned_by SET NOT NULL;
