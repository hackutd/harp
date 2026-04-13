DELETE FROM settings WHERE key IN (
    'application_schema',
    'reviews_per_application',
    'review_assignment_toggle',
    'scan_types',
    'scan_stats',
    'admin_schedule_edit_enabled',
    'hackathon_date_range',
    'applications_enabled'
);
