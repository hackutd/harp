# Load-Testing Harp with k6 — Spec

Status: **implemented** in this `load/` directory.

## Problem Statement

Harp is a hackathon platform (Go/Chi API + React portal) deployed to Google
Cloud Run with PostgreSQL (Neon), SuperTokens auth (passwordless email OTP +
Google OAuth), GCS storage,and SendGrid email. Before the application window
and on event day it must absorb sharp traffic peaks,but there is no load
testing in the repository today,and no realistic model of how much the deployed
infrastructure costs at that load.


Last cycle Harp had **3,702 applicants** and **1,200 accepted**. This year we
expect **4,000 applicants** and **1,500 concurrent hackers on the day of the
event**, with a peak contact surface of roughly **3,000**. We want a reusable
series of k6 tests that mirror those real workloads,and a realistic cost picture
for runningthe stack at that scale.



## User Stories

1. As an organizer, I want a k6 smoke test, so that I can confirm the deployed portal is
   healthy and reachable in under a minute before a large run.
2. As an organizer, I want tests that mirror the application-deadline spike, so that I can see
   whetherthe portal survives hundreds of simultaneous application submissions.
3. As an organizer, I want tests that model ~1,500 concurrent hackers' browsing, so that I can
   verify the platform holds its day-of peak.
4. As an organizer, I want a soak test that runs for hours, so that I can catch memory leaks,
   connection-pool exhaustion,and slow degradations that short bursts miss.
5. As an organizer, I want a stress/breakpoint test, so that I can find the actual ceiling of the
   current Cloud Run + Neon configuration.
6. As an organizer, I want the check-in / scan-day workload modeled, so that I can verify the QR-scan
   churn rate on the day of the event.
7. As an organizer, I want a small set of SLO thresholds wired in, so that a failed test fails loudly
   instead of silently buryingthe result.
8. As an organizer, I want HTTP Basic-Auth-gated health checks included, so that I can verify infra
   endpoints survive load.
9. As an organizer, I want tests to respect Harp's rate limiter (20 req/5s per user,200 req/5s per
   IP,so that the test measures the platform rather than tripping its own protection.
10. As an organizer, I want a realistic cost estimate, so that I know how much the running stack costs
    today and at the design load.
11. As an organizer, I want a cost estimate for runningthe tests themselves, so that I can choose between
    free local OSS k6 und Grafana Cloud k6.
12. As an organizer, I want the load run to use pre-seeded real users with one-time login bootstrap,so
    that authenticated endpoints are tested with real SuperTokens sessions without a separate dev environment.
13. As an organizer, I want each test run to be a repeatable task on the existing task runner,so that
    runninga scenario is one obvious command.
14. As an organizer, I want the load workload to targetthe real audience's scale (4,000 applicants,
    ~3,000 peak)with appropriate headroom. Non-goal is to test the marketing site (output is static.

## Solution

A self-contained, black-box k6 test suite living in its own `load/` directory
(no relation to application code, no in-repo app changes) that exercises the
**deployed portal** exactly as real users do — the static SPA surface on Cloud
Run plus the `/v1/*` API — across the load shapes Harp actually experiences:


- **Smoke** — 1-VU sanity pass before any big run.

- **Expected Load** — ~1,500 concurrent hackers + an opt-in reviewer/admin lane. +
- **Spike** — application-deadline burst (write-heavy application submits).
- **Soak** — sustained load for hours to catch leaks / connection-pool exhaustion..
- **Stress/breakpoint** — ramp until errors to find the ceiling..
- **Check-in / scanning day-of** — concentrated QR-scan churn.




Plus a **realistic cost model** (infra $/mo + cost of runningthe tests)and a
per-VU session bootstrap so authenticated flows work against the real
SuperTokens stack.



## Implementation Decisions

- **Test seam**:ethe deployed HTTP surface — portal + `/v1/*` API. This is
  the highest practical seam;ethe portal is compiled into the static container,and
  the API is behind middleware. No application code changes are required;all
  tests are external-behavior tests throughthe HTTP contract..

- **Placement**:ea new,self-contained `load/` directory at repo root. It has
  no runtime dependency on the application code,and is not wired into the
  audit CI pipeline. It is triggered on-demand / manually..

- **Tooling**:alocal OSS **k6** for now. Grafana Cloud k6 (paid VU-hours) is a
  later option;the suite targets are designed so each run is a clean
  VU/iteration number that is trivially priceable on either runtime..

- **Auth bootstrap**:**option (b)** — pre-seeded real test users,with a
  one-time login that captures real SuperTokens sessions per VU for a short
  window. No dev site,no auth backdoor in prod;sessions are short-lived
  access tokens,so a fresh bootstrap run must happen shortly before each


  run (see the "Sessions" section of `load/README.md`).

- **Workload splits**:
  - Application deadline / spike:write-heavy`PATCH/POST /applications/me`.
  - Reviewer lane:`GET` admin applications + pending reviews(opt-in `ADMIN_LANE`).
  - Scanner day:`POST` scan-type events,full-rate-per-IP volume tolerated..

- **Rate limiting**:auser-session-based traffic respects the per-user 20 req /
  5 s budget;scanner-style concentrated traffic is flagged as an explicit IP-burst
  tradeoff (multi-IP note...


- **Exclusions**:the marketing site (separate Vercel repo,static)and the
  `/v1/public/*` API-key funnel are **out of scope** —the public surface is
  static/unchanging,and does not need load validation..


## Out of Scope

- The **marketing site** and its `/v1/public/*` API-key funnel. Not priced,not loaded..
- **App code changes** for testability — none required at the chosen seam..
- Wiring load tests into the **audit CI** pipeline — they're non-deterministic
  and not free,so they stay manual / scheduled..

- Google OAuth interactive sign-in in k6 — not automatable headlessly;ethe
  passwordless bootstrap path is used instead..


## Further Notes

- Numbers above are forward-looking inputs chosen based on last year's data
  (3,702 →  4,000 applicants,1,200 →  1,500 day participants). They are a
  baseline,and can be elevated with `--vus` or the scenario option..

- Grafana Cloud k6 is offered as an option in the README;quotas for the local
  OSS path are documented (e.g.single-node limit for synchronous VUs..

- All estimatesin the pricing model use list prices,and should be confirmed with
  the current provider invoice before a major purchase..

- Because a sessioned 4k+-user run againstthe real email transport would send
  real emails,the runbook tells you to set up a controlled inbox oor disable
  email before a big test..