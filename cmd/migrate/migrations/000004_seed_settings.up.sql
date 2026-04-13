-- Application form schema: defines all fields the hacker application form renders.
-- Super admins can modify this at runtime to add/remove/reorder fields.
-- Supported field types: text, number, textarea, select, multi_select, checkbox, phone
INSERT INTO settings (key, value) VALUES ('application_schema', '[
    {"id": "first_name",              "type": "text",         "label": "First Name",              "required": true,  "section": "personal",   "display_order": 1},
    {"id": "last_name",               "type": "text",         "label": "Last Name",               "required": true,  "section": "personal",   "display_order": 2},
    {"id": "phone",                   "type": "phone",        "label": "Phone Number",            "required": false, "section": "personal",   "display_order": 3},
    {"id": "age",                     "type": "number",       "label": "Age",                     "required": true,  "section": "personal",   "display_order": 4, "validation": {"min": 0, "max": 120}},
    {"id": "country_of_residence",    "type": "text",         "label": "Country of Residence",    "required": false, "section": "personal",   "display_order": 5},
    {"id": "gender",                  "type": "text",         "label": "Gender",                  "required": false, "section": "personal",   "display_order": 6},
    {"id": "race",                    "type": "text",         "label": "Race",                    "required": false, "section": "personal",   "display_order": 7},
    {"id": "ethnicity",              "type": "text",         "label": "Ethnicity",               "required": false, "section": "personal",   "display_order": 8},

    {"id": "university",             "type": "text",         "label": "University",              "required": true,  "section": "education",  "display_order": 10},
    {"id": "major",                  "type": "text",         "label": "Major",                   "required": true,  "section": "education",  "display_order": 11},
    {"id": "level_of_study",         "type": "select",       "label": "Level of Study",          "required": true,  "section": "education",  "display_order": 12, "options": ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "PhD", "Other"]},

    {"id": "github",                 "type": "text",         "label": "GitHub",                  "required": false, "section": "links",      "display_order": 20},
    {"id": "linkedin",               "type": "text",         "label": "LinkedIn",                "required": false, "section": "links",      "display_order": 21},
    {"id": "website",                "type": "text",         "label": "Personal Website",        "required": false, "section": "links",      "display_order": 22},

    {"id": "hackathons_attended",    "type": "number",       "label": "Hackathons Attended",     "required": false, "section": "experience", "display_order": 30, "validation": {"min": 0}},
    {"id": "experience_level",       "type": "select",       "label": "Software Experience",     "required": false, "section": "experience", "display_order": 31, "options": ["Beginner", "Intermediate", "Advanced", "Expert"]},
    {"id": "heard_about",            "type": "text",         "label": "How did you hear about us?", "required": false, "section": "experience", "display_order": 32},

    {"id": "saq_1",                  "type": "textarea",     "label": "Why do you want to attend this hackathon?",                                               "required": true, "section": "short_answers", "display_order": 40, "validation": {"maxLength": 1000}},
    {"id": "saq_2",                  "type": "textarea",     "label": "How many hackathons have you submitted to and what did you learn from them?",               "required": true, "section": "short_answers", "display_order": 41, "validation": {"maxLength": 1000}},
    {"id": "saq_3",                  "type": "textarea",     "label": "If you haven''t been to a hackathon, what do you hope to learn from this hackathon?",       "required": true, "section": "short_answers", "display_order": 42, "validation": {"maxLength": 1000}},
    {"id": "saq_4",                  "type": "textarea",     "label": "What are you looking forward to do at this hackathon?",                                    "required": true, "section": "short_answers", "display_order": 43, "validation": {"maxLength": 1000}},

    {"id": "shirt_size",             "type": "select",       "label": "Shirt Size",              "required": false, "section": "logistics",  "display_order": 50, "options": ["XS", "S", "M", "L", "XL", "XXL"]},
    {"id": "dietary_restrictions",   "type": "multi_select", "label": "Dietary Restrictions",    "required": false, "section": "logistics",  "display_order": 51, "options": ["Vegan", "Vegetarian", "Halal", "Nuts", "Fish", "Wheat", "Dairy", "Eggs", "No Beef", "No Pork"]},
    {"id": "accommodations",         "type": "textarea",     "label": "Accommodations",          "required": false, "section": "logistics",  "display_order": 52}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Reviews per application threshold
INSERT INTO settings (key, value) VALUES ('reviews_per_application', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Review assignment toggle (seeded empty — populated when admins are added)
INSERT INTO settings (key, value) VALUES ('review_assignment_toggle', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Scan types
INSERT INTO settings (key, value) VALUES ('scan_types', '[{"name": "check_in", "display_name": "Check In", "category": "check_in", "is_active": true}]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Scan stats cache
INSERT INTO settings (key, value) VALUES ('scan_stats', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Admin schedule editing permission
INSERT INTO settings (key, value) VALUES ('admin_schedule_edit_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Hackathon date range
INSERT INTO settings (key, value) VALUES ('hackathon_date_range', '{"start_date": null, "end_date": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Applications enabled toggle
INSERT INTO settings (key, value) VALUES ('applications_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
