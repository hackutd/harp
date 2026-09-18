# QA Checklist — `/admin/all-applicants` status filter tabs stay on one row

Issue: the six status filter tabs (`All`, `Draft`, `Submitted`, `Accepted`, `Waitlisted`, `Rejected`) wrapped onto a second row at common desktop widths, so the `Rejected` tab hung alone on its own line and the filter bar became a tall, mostly-empty rectangle that pushed the table down. The fix matches the `/admin/sa/reviews` filter row so tabs stay on a single line from 1024px.

## Setup
- Signed in as an **admin**, open `/admin/all-applicants` with applications present so all six tabs show counts (e.g. `All 407`, `Draft 228`, `Submitted 179`, …). Use browser devtools to set/resize the viewport width precisely.

## Desktop 1024px–1536px — tabs on one row
- [ ] At a viewport width of **1024px**, all six status tabs (All, Draft, Submitted, Accepted, Waitlisted, Rejected) appear on one single row — none is orphaned onto a second line.
- [ ] At **1280px** and **1440px** (common desktop widths), the six tabs still render on one row with no tab wrapping below the others.
- [ ] At **1536px** and wider, the six tabs remain on a single row.

## Filter bar height / parity with reviews
- [ ] Given `/admin/all-applicants` and `/admin/sa/reviews` each open at the same desktop width, the filter bar (the tab strip) on all-applicants is one tab tall — not a tall, mostly-empty rectangle — and matches the reviews page's filter row in height.
- [ ] No extra blank vertical space is left between the status tabs and the applications table.

## Search & pagination controls stay on the row
- [ ] At desktop widths (1024px–1536px), the search box and pagination controls sit on the same row as the status tabs, not pushed below or squeezed.
- [ ] The search input remains fully usable at its normal width (not compressed to a stub) across the desktop range.

## Below `lg` (< 1024px) — deliberate wrap, no fat rectangle
- [ ] At **768px** and at **~390px**, the six tabs arrange in a tidy, even multi-row grid (each full-width row filled) — never a single stray tab hanging alone on a final row.
- [ ] Below 1024px, the filter bar does not look like a tall empty rectangle; wrapping is clean and the search control lines up without overlapping.
- [ ] Below 1024px, the page does not force horizontal scroll for the filter bar, and the applications table remains reachable/usable.

## Filtering behavior unchanged
- [ ] Clicking **All, Draft, Submitted, Accepted, Waitlisted, and Rejected** each filters the list to that status, exactly as before the fix.
- [ ] After selecting a tab, resizing across the 1024px breakpoint keeps the selection active and keeps the tabs on a single row.
- [ ] Each tab's count badge matches the number shown in its card/table for that status (even when the count is `0`).

## Regression — reviews page
- [ ] `/admin/sa/reviews` still renders its filter tabs on one row with no orphaned tab, unchanged by this work.

## Acceptance criteria traced
- **AC1 (1024–1536px, single row, no orphan)** → "Desktop 1024px–1536px" section.
- **AC2 (filter bar height matches reviews)** → "Filter bar height / parity with reviews" section.
- **AC3 (search & sort stay aligned, not squeezed)** → "Search & pagination controls stay on the row" section.
- **AC4 (below `lg` wraps/scrolls deliberately, no fat rectangle)** → "Below `lg`" section.
- **AC5 (filtering unchanged; lint & build pass)** → "Filtering behavior unchanged" section covers the behavior half; lint/build are automated, see "Not covered".

## Not covered
- **`npm run lint` / `npm run build`** are automated/CLI checks, not manual UI tests — a human tester runs them in a terminal rather than via the app. They are AC5's non-behavioral half.
- **All six counts distinct & large (e.g. 407 / 228 / 179)** requires seeded data; the "no orphan at 1024px" worst case depends on the widest realistic label/badge combination present in the tester's data.
- **Scroll behaviour** below `lg` is asserted only informally; if the container ever scrolls horizontally instead of wrapping, that needs a browser-threshold check not visible from code alone.