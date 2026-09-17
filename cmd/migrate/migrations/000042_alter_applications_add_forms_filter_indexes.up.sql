-- The Forms & Responses workspace filters the application list by travel and
-- RSVP state on every tab, but migrations 000034-000041 added those columns
-- without any index, so each tab was a sequential scan.
--
-- Each index carries the sort key as well as the filter column. That ordering
-- is what makes them worth having: the Forms tabs never send sort_by, so they
-- always page on (created_at DESC, id DESC), and an index on the filter column
-- alone is actually SLOWER than no index at all -- the planner stops walking
-- created_at in order and instead collects every matching row to sort it.
-- Carrying created_at lets the scan come out already ordered and stop at the
-- page size.
--
-- The partial predicates mirror what each tab always pins: the RSVP tab pins
-- status = 'accepted', and the travel tab pins travel_requested, which the list
-- query spells as travel_status != 'not_requested'.
CREATE INDEX idx_applications_travel_status
    ON applications (travel_status, created_at DESC, id DESC)
    WHERE travel_status != 'not_requested';

CREATE INDEX idx_applications_accepted_rsvp
    ON applications (rsvp_status, created_at DESC, id DESC)
    WHERE status = 'accepted';

CREATE INDEX idx_applications_travel_rsvp_status
    ON applications (travel_rsvp_status, created_at DESC, id DESC)
    WHERE travel_status != 'not_requested';
