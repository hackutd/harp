-- The travel cost estimate lives inside the free-text responses JSONB, so both
-- the admin list and the Forms summary used to re-derive it with a regex and a
-- numeric cast on every row -- which also meant detoasting responses just to
-- read one key. Storing it removes the regex from both queries.
--
-- The digit bound matters for more than tidiness. travel_estimated_cost is a
-- number field with min: 0 and no max, and validateResponses only enforces the
-- bounds the schema actually sets, so a large enough value overflowed
-- ROUND(...)::bigint and 500'd the whole admin list. Anything outside the bound
-- now reads as NULL instead. The CASE has no ELSE that can throw, so this
-- expression can never fail a hacker's own application write.
ALTER TABLE applications
    ADD COLUMN travel_estimated_cost_cents BIGINT
    GENERATED ALWAYS AS (
        CASE WHEN responses->>'travel_estimated_cost' ~ '^[0-9]{1,9}([.][0-9]{1,2})?$'
             THEN ROUND((responses->>'travel_estimated_cost')::numeric * 100)::bigint END
    ) STORED;
