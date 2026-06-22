UPDATE settings
SET value = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(value) AS elem
    WHERE elem->>'name' != 'walk_in'
)
WHERE key = 'scan_types';
