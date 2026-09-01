INSERT INTO settings (key, value) VALUES ('admin_faq_edit_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
