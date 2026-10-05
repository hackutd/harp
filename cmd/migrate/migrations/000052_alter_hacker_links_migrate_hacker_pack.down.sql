INSERT INTO settings (key, value)
SELECT 'hacker_pack_url', to_jsonb(url)
FROM hacker_links
WHERE label = 'Hacker Pack' AND icon = 'notion'
ORDER BY display_order
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

DELETE FROM hacker_links WHERE label = 'Hacker Pack' AND icon = 'notion';
