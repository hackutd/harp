UPDATE settings
SET value = value || '[{"name":"walk_in","display_name":"Walk-In","category":"walk_in","is_active":true}]'::jsonb
WHERE key = 'scan_types'
  AND NOT (value @> '[{"name":"walk_in"}]'::jsonb);
