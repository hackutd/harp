-- Remove lingering review_assignment_enabled setting if it exists
DELETE FROM settings WHERE key = 'review_assignment_enabled';
