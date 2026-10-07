BEGIN;

-- Expand only: ai_percent stays so the previous release keeps working while
-- this migration is applied ahead of the deploy. Drop it in a later migration.
ALTER TABLE applications
    ADD COLUMN ai_score DOUBLE PRECISION,
    ADD COLUMN ai_verdict TEXT,
    ADD COLUMN ai_class_human DOUBLE PRECISION,
    ADD COLUMN ai_class_ai DOUBLE PRECISION,
    ADD COLUMN ai_class_ai_edited DOUBLE PRECISION,
    ADD COLUMN ai_class_humanized DOUBLE PRECISION,
    ADD CONSTRAINT applications_ai_score_check CHECK (ai_score BETWEEN 0 AND 1),
    ADD CONSTRAINT applications_ai_verdict_check CHECK (ai_verdict IN ('human', 'ai', 'ai_edited', 'humanized')),
    ADD CONSTRAINT applications_ai_class_human_check CHECK (ai_class_human BETWEEN 0 AND 1),
    ADD CONSTRAINT applications_ai_class_ai_check CHECK (ai_class_ai BETWEEN 0 AND 1),
    ADD CONSTRAINT applications_ai_class_ai_edited_check CHECK (ai_class_ai_edited BETWEEN 0 AND 1),
    ADD CONSTRAINT applications_ai_class_humanized_check CHECK (ai_class_humanized BETWEEN 0 AND 1);

UPDATE applications SET ai_score = ai_percent / 100.0 WHERE ai_percent IS NOT NULL;

COMMIT;
