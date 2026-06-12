-- Remove the meal_groups setting
DELETE FROM settings WHERE key = 'meal_groups';

-- Remove the meal_group column from applications
ALTER TABLE applications DROP COLUMN meal_group;
