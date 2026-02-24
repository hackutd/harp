INSERT INTO settings (key, value)
SELECT
  'review_assignment_enabled',
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'enabled', true
      )
    ),
    '[]'::jsonb
  )
FROM users u
WHERE u.role = 'super_admin';