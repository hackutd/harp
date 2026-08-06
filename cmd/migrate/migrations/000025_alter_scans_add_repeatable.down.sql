DROP INDEX IF EXISTS idx_scans_user_id;
DROP INDEX IF EXISTS uq_scans_user_scan_type_once;

-- Restoring the constraint fails if repeatable duplicate rows exist; remove
-- all but the earliest scan per (user_id, scan_type) first.
DELETE FROM scans s
USING scans keep
WHERE s.user_id = keep.user_id
  AND s.scan_type = keep.scan_type
  AND (s.created_at, s.id) > (keep.created_at, keep.id);

ALTER TABLE scans ADD CONSTRAINT scans_user_id_scan_type_key UNIQUE (user_id, scan_type);

ALTER TABLE scans DROP COLUMN IF EXISTS repeatable;
