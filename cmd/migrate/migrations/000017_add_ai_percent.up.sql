ALTER TABLE applications
ADD COLUMN ai_percent SMALLINT DEFAULT NULL;

ALTER TABLE applications
ADD CONSTRAINT applications_ai_percent_check
CHECK (ai_percent IS NULL OR (ai_percent >= 0 AND ai_percent <= 100));
