-- Add nullable meal_group column to applications
ALTER TABLE applications ADD COLUMN meal_group TEXT;

-- Add default meal groups to settings
-- Assumes a settings table with 'key' and 'value' (JSONB) columns
INSERT INTO settings (key, value)
VALUES ('meal_groups', '["A", "B", "C", "D"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
