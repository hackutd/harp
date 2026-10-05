-- Deleting a staff account used to cascade into every scan that person ever
-- performed, wiping other hackers' check-in, meal, and points history. Keep the
-- scan and drop only the attribution.
ALTER TABLE scans ALTER COLUMN scanned_by DROP NOT NULL;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scanned_by_fkey;

ALTER TABLE scans ADD CONSTRAINT scans_scanned_by_fkey
    FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE SET NULL;
