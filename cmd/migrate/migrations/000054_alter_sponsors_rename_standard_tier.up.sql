-- The catch-all sponsor tier is shown publicly as "Other Sponsors".
UPDATE sponsors SET tier = 'Other Sponsors' WHERE tier = 'Standard';
