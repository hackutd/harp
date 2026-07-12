UPDATE settings
SET value = COALESCE(
    (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(value) AS elem
        WHERE elem->>'name' != 'walk_in'
    ),
    '[]'::jsonb
)
WHERE key = 'scan_types';
