-- RSVP form schema: defines the fields accepted hackers fill out when claiming their spot.
-- Super admins can modify this at runtime to add/remove/reorder fields.
-- Supported field types: text, number, textarea, select, multi_select, checkbox, phone
INSERT INTO settings (key, value) VALUES ('rsvp_schema', '[
    {"id": "discord_username",        "type": "text",     "label": "Discord Username",                "required": true,  "section": "rsvp", "section_label": "RSVP Details", "section_order": 1, "display_order": 1},
    {"id": "emergency_contact_name",  "type": "text",     "label": "Emergency Contact Name",          "required": true,  "section": "rsvp", "section_label": "RSVP Details", "section_order": 1, "display_order": 2},
    {"id": "emergency_contact_phone", "type": "phone",    "label": "Emergency Contact Phone",         "required": true,  "section": "rsvp", "section_label": "RSVP Details", "section_order": 1, "display_order": 3},
    {"id": "ack_attendance",          "type": "checkbox", "label": "I confirm that I will attend the event and understand my spot may be released if I do not check in", "required": true, "section": "rsvp", "section_label": "RSVP Details", "section_order": 1, "display_order": 4},
    {"id": "additional_notes",        "type": "textarea", "label": "Anything else we should know?",   "required": false, "section": "rsvp", "section_label": "RSVP Details", "section_order": 1, "display_order": 5, "validation": {"maxLength": 1000}}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
