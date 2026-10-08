-- Profiles with more than three past roles keep only the first three.
UPDATE attendee_directory_profiles
SET experiences = (
    SELECT COALESCE(jsonb_agg(e ORDER BY i), '[]'::jsonb)
    FROM jsonb_array_elements(experiences) WITH ORDINALITY AS t(e, i)
    WHERE i <= 3
)
WHERE jsonb_array_length(experiences) > 3;

ALTER TABLE attendee_directory_profiles
    DROP CONSTRAINT IF EXISTS attendee_directory_profiles_experiences_check;

ALTER TABLE attendee_directory_profiles
    ADD CONSTRAINT attendee_directory_profiles_experiences_check
        CHECK (jsonb_typeof(experiences) = 'array' AND jsonb_array_length(experiences) <= 3);
