UPDATE settings
SET value = (
    SELECT jsonb_agg(
        CASE
            WHEN elem->>'id' = 'hackathons_attended'
                THEN elem #- '{validation,max}'
            ELSE elem
        END
        ORDER BY ord
    )
    FROM jsonb_array_elements(settings.value) WITH ORDINALITY AS t(elem, ord)
)
WHERE key = 'application_schema'
  AND jsonb_typeof(value) = 'array';
