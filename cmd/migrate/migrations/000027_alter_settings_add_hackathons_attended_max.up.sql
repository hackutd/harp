-- hackathons_attended shipped with only a min, so applicants could enter any
-- number. Values above smallint range then broke the admin applications list.
-- Patches the live schema in place, preserving field order.
UPDATE settings
SET value = (
    SELECT jsonb_agg(
        CASE
            WHEN elem->>'id' = 'hackathons_attended'
                THEN jsonb_set(elem, '{validation,max}', '100'::jsonb, true)
            ELSE elem
        END
        ORDER BY ord
    )
    FROM jsonb_array_elements(settings.value) WITH ORDINALITY AS t(elem, ord)
)
WHERE key = 'application_schema'
  AND jsonb_typeof(value) = 'array';
