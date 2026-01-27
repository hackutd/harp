CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- default short answer questions
INSERT INTO settings (key, value) VALUES ('short_answer_questions', '[
    {"id": "why_attend", "question": "Why do you want to attend this hackathon?", "required": true, "display_order": 1},
    {"id": "hackathons_learned", "question": "How many hackathons have you submitted to and what did you learn from them?", "required": true, "display_order": 2},
    {"id": "first_hackathon_goals", "question": "If you haven''t been to a hackathon, what do you hope to learn from this hackathon?", "required": true, "display_order": 3},
    {"id": "looking_forward", "question": "What are you looking forward to do at this hackathon?", "required": true, "display_order": 4}
]'::jsonb);
