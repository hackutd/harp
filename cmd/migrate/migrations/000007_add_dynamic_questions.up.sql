CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- default short answer questions
INSERT INTO settings (key, value) VALUES ('short_answer_questions', '[
    {"id": "saq_1", "question": "Why do you want to attend this hackathon?", "required": true, "display_order": 1},
    {"id": "saq_2", "question": "How many hackathons have you submitted to and what did you learn from them?", "required": true, "display_order": 2},
    {"id": "saq_3", "question": "If you haven''t been to a hackathon, what do you hope to learn from this hackathon?", "required": true, "display_order": 3},
    {"id": "saq_4", "question": "What are you looking forward to do at this hackathon?", "required": true, "display_order": 4}
]'::jsonb);
