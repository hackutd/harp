BEGIN;

-- ai_percent was kept in sync on every write, so dropping the new columns
-- loses only the extra precision and the verdict/class details.
ALTER TABLE applications
    DROP COLUMN ai_score,
    DROP COLUMN ai_verdict,
    DROP COLUMN ai_class_human,
    DROP COLUMN ai_class_ai,
    DROP COLUMN ai_class_ai_edited,
    DROP COLUMN ai_class_humanized;

COMMIT;
