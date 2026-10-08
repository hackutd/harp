-- Let a directory profile list up to five past roles instead of three.
ALTER TABLE attendee_directory_profiles
    DROP CONSTRAINT IF EXISTS attendee_directory_profiles_experiences_check;

ALTER TABLE attendee_directory_profiles
    ADD CONSTRAINT attendee_directory_profiles_experiences_check
        CHECK (jsonb_typeof(experiences) = 'array' AND jsonb_array_length(experiences) <= 5);
