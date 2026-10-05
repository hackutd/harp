-- The Hacker Pack used to be a single Notion embed stored in the
-- hacker_pack_url setting. Notion pages are now regular hacker links
-- (icon 'notion'), so carry the saved embed over as the first link and drop
-- the old setting.
WITH pack AS (
    SELECT btrim(value #>> '{}') AS url
    FROM settings
    WHERE key = 'hacker_pack_url'
      AND jsonb_typeof(value) = 'string'
      AND btrim(value #>> '{}') <> ''
), shifted AS (
    UPDATE hacker_links
    SET display_order = display_order + 1
    WHERE EXISTS (SELECT 1 FROM pack)
)
INSERT INTO hacker_links (label, url, icon, display_order)
SELECT 'Hacker Pack', url, 'notion', 0
FROM pack;

DELETE FROM settings WHERE key = 'hacker_pack_url';
