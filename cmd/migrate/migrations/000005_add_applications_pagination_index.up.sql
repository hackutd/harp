CREATE INDEX IF NOT EXISTS idx_applications_created_at_id
ON applications (created_at DESC, id DESC);
