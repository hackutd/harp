DELETE FROM settings WHERE key IN (
    'hackathon_name',
    'contact_email',
    'from_email',
    'from_name',
    'application_due_date',
    'decision_release_date',
    'event_start_date'
);
