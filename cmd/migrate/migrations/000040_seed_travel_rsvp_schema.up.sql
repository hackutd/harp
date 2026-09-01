-- Travel RSVP form schema: proof-of-travel details filled out by hackers whose
-- travel reimbursement was approved. Super admins can modify this at runtime.
-- Supported field types: text, number, textarea, select, multi_select, checkbox, phone
-- Conditional fields: validation.show_if / required_if accept either a checkbox
-- field id ("field") or a select equality condition ("field=Value").
INSERT INTO settings (key, value) VALUES ('travel_rsvp_schema', '[
    {"id": "travel_rsvp_mode",  "type": "select",   "label": "How will you be traveling?",      "required": true,  "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 1, "options": ["Driving", "Flying", "Bus", "Train", "Other"]},
    {"id": "flight_airline",    "type": "text",     "label": "Airline",                         "required": false, "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 2, "validation": {"show_if": "travel_rsvp_mode=Flying", "required_if": "travel_rsvp_mode=Flying"}},
    {"id": "flight_numbers",    "type": "text",     "label": "Flight number(s)",                "required": false, "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 3, "validation": {"show_if": "travel_rsvp_mode=Flying", "required_if": "travel_rsvp_mode=Flying"}},
    {"id": "payment_method",    "type": "select",   "label": "How would you like to be paid?",  "required": true,  "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 4, "options": ["Zelle", "Venmo", "PayPal"]},
    {"id": "payment_details",   "type": "text",     "label": "Payment handle / details (Zelle email, Venmo username, or PayPal email)", "required": true, "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 5},
    {"id": "travel_notes",      "type": "textarea", "label": "Anything else we should know?",   "required": false, "section": "travel_rsvp", "section_label": "Travel Details", "section_order": 1, "display_order": 6, "validation": {"maxLength": 1000}}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
