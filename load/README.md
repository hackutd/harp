# Harp k6 load-testing suite

Black-box load tests for the **deployed Harp portal** (React SPA + Go `/v1` API,
served from one Cloud Run origin). No application code changes are required;these
scenarios hit the live HTTP contract the way real hackers, reviewers, and scanners do.

> These tests hit a **live deployed** target, by your choice. They are write-heavy
> in places (spike submits, scan-day churn) and, on an authed run, touch real
> sessions.This is a load tool, not a CI health check.:do not wire it into the audit
> pipeline, and be deliberate about which environment you point `BASE_URL` at.

## Prereqs

- **Docker** (compose plugin; recommended` — nothing else: the `grafana/k6` image
  is pinned in [`docker-compose.load.yml`](../docker-compose.load.yml`,so no manual k6
  install is needed. Pass any `-e KEY=value` flags after `k6 run`.
- Alternative:use a **local OSS k6** install (no container)and replace the `docker compose …
  run --rm k6` prefix witha bare `k6`(see the compose overlay for the workdir mapping`.
- For authenticated scenarios:areal session pool (see "Sessions" below..

## Quick start

The common case needs **no flags at all** — `load/config.json` holds the target
`baseUrl`, the `scenario`, and the session file, and everything resolves from there
(explicit `-e KEY=value` flags still win when you need to override for one run):

```sh
# Show what the configured scenario would run (no traffic):
task load:preview            # or: DRY_RUN=1 bash load/run.sh
#   load/run: scenario=load.js baseUrl=https://your-portal.example.com sessions=sessions.json

# Run whatever scenario load/config.json names (default load.js):
task load:run                # or: bash load/run.sh
bash load/run.sh --vus 3000  # append extra k6 flags
SCENARIO=stress.js bash load/run.sh   # one-off scenario override
BASE_URL=https://prod.example bash load/run.sh  # one-off origin override
```

The equivalent long-hand form (all six scenarios run the same way) is unchanged:

```sh
docker compose -f docker-compose.load.yml run --rm k6 run -e BASE_URL=https://your-portal.example.com scenarios/smoke.js
docker compose -f docker-compose.load.yml run --rm k6 run -e BASE_URL=https://your-portal.example.com -e SESSIONS_FILE=sessions.json scenarios/load.js
```

> `run --rm` runs a one-shot container that exits when the test finishes (no daemon left behind).
> Mounting:the `/load` bind mount makes `scenarios/<file>` (and e.g.`sessions.json`) the module
> `../lib` imports path — reference scripts relativeto `load/`, session files at its root.,

## Config (`load/config.json`)

`load/config.json` is the single committed source of defaults for a run. The
scenarios read it through `load/lib/resolve.js` (kept free of k6 globals and unit
tested with `node lib/resolve.test.js`), and `load/run.sh` / `task load:run` read
the same file to pick the scenario.

```json
{
  "baseUrl": "https://your-portal.example.com",
  "scenario": "load.js",
  "sessionsFile": "sessions.json"
}
```

| Key | Meaning |
|---|---|
| `baseUrl` | deployed portal origin (default placeholder) |
| `scenario` | scenario to run from `scenarios/` (one of `smoke.js`, `load.js`, `spike-deadline.js`, `soak.js`, `stress.js`, `checkin-scan.js`) |
| `sessionsFile` | session-cookie pool file; git-ignored, keep local |

Precedence everywhere is **explicit `-e`/env flag > `config.json` > built-in default**,
so `-e BASE_URL=… -e SESSIONS_FILE=… -e SCENARIO=…` still override for a one-off.
Point `CONFIG_FILE` at another file to swap configs wholesale.

## Scenarios

| Scenario | File | Shape | Default scale |
|---|---|---|---|
| Smoke | `smoke.js` | 1-VU sanity | 1 VU |
| Expected load | `load.js` | ramp tosteady day-of mix | 1,500 VU |
| Deadline spike | `spike-deadline.js` | ramp write-heavy submits | 500 VU |
| Soak | `soak.js` | steady sustained | 300 VU / 30 min |
| Stress | `stress.js` | ramp past ceiling |urch 2,500 VU |
| Scan day | `checkin-scan.js` | steady QR-scan churn |urch 40 VU |


Run any scenario the same way,and use the `task load:…` wrappers in root `Taskfile.yml`.
Override scale the usual k6 way:
edit the `vus` / `stages` targets in the scenario,or add extra k6 flags right after `run`, e.g.:

```sh
docker compose -f docker-compose.load.yml run --rm k6 run -e BASE_URL=https://your-portal.example.com --vus 3000 scenarios/load.js
```

> Note: pass `-e KEY=value` after `k6 run` — those populate the `__ENV` the scripts read
> (and never echo secrets to logs;pass `-e` values vars from your shell/.env, not pasted inline`).

## Flags (via `-e KEY=value`)

| Key | Meaning | Default |
|---|---|---|
| `BASE_URL` | deployed portal origin | config `baseUrl` (else placeholder) |
| `SESSIONS_FILE` | path to the per-VU session-cookie pool (bare array **or** `{"sessions":[...]}`) | config `sessionsFile` (else public/static fallback) |
| `AUTH_BASIC_USER` / `AUTH_BASIC_PASS` |Basic-Auth creds for `/v1/health` |none =(health skipped |
| `PROFILE` |hacker |reviewer |scanner |>none (scenario-driven |
| `ADMIN_LANE` |spawn a small reviewer/admin lane within `load.js` (adds GET `/v1/admin/applications` + `/v1/admin/reviews/pending`). Session pool must hold admin-role users |off |
| `RATE_WINDOW`,`RATE_PER_USER`,`RATE_PER_IP` |rate-limiter facts for your deploy |5 / 20 / 200 |

## Sessions (option "b": pre-seeded real users)

Authenticated endpointsneed a real SuperTokens session. Because Harp auth is
passwordless (email OTP) + Google OAuth, there is no headless password flow for
k6.Two options:

> The session pool lives in a **git-ignored** file (`load/sessions.json` by
> default, via `config.json → sessionsFile`). It is never committed; edit
> `load/config.json` to point at your local pool. The pool file accepts either a
> bare JSON array of cookie strings (back-compat) or `{ "baseUrl": …, "sessions": [… ] }`.

1. **Short-lived bootstrap (one-time,matches the chosen option**:mint a pool of
   session cookies for as many accounts as you can stand,write them as a JSON array
   (each element is the raw `Cookie` header value, e.g``"sAccessToken=...; sIdRefreshToken=..."`)
   toa file,and pass `SESSIONS_FILE}`. Each VU picks one by index. SuperTokens access
   tokens expire (~1h);mint right before a scheduled run..

2. **No sessions (default fallback)**:the scenarios degrade to public/static/read
   endpoints that need no login. Good for capacity sanity;it won'thit authed paths..

> Because authed spikes would trigger**real SuperTokens session invalidation** and the
> email re-verify path, set up a controlled seed inbox (or disable email``) before
> thech big runs.At 1,500+ VUs,do not point real applicant emails at this.,

## Rate limiting

Harp limits `/v1/*` at **20 req / 5 s per signed-in user** and **200 req /
5 s per IP** for sessionless traffic. The scenarios pace requests to stay under
the per-user budget when a session pool is used and document the per-IP ceiling
for the no-session (and scan-day``)) cases. `429`s are counted as errors in thresholds.

### Fail-fast guard / status surfacing (load.js)

`load.js` now refuses to start a sessionless ramp that would flood the per-IP
rate limiter, so you never mistake a 429 storm for a capacity test. If no
`SESSIONS_FILE` is set and the ramp exceeds `IP_WARN_VU` (default 200) VUs, it
prints a loud banner and aborts in `setup()` before any VUs start. To run the
shared-per-IP mode deliberately as a capacity sanity check, pass
`-e FORCE_IP_MODE=1`.

In `FORCE_IP_MODE`, the 4xx threshold is relaxed (429 is the expected limiter
signal) and the summary surfaces the status-code spread via the
`http_status_codes` counter plus the `status is 200` / `status is 2xx/3xx` /
`not rate-limited (429)` checks. Only `http_5xx_rate` still aborts fast, so a
real infra failure stops the run while an intentional 429 flood does not.

## Writing/breaking point

- **Soak** 30 min steady catches leaks / pool exhaustion (Harp defaults to
  `DB_MAX_OPEN_CONNS=30`).
- **Stress** leaves thresholds loose on purpose:** it ramps until the platform
  starts failing, then you read the k6 summary to find the ceiling.,

## License / layout

- `load/scenarios/*.js` — one scenario each
- `load/config.json` — committed run defaults (baseUrl / scenario / sessionsFile); copy `config.example.json`
- `load/run.sh` — short-command dispatcher that reads config.json and runs k6 (`task load:run`)
- `load/lib/helpers.js` — shared config / jitter / rate facts
- `load/lib/resolve.js` — pure, unit-tested config/session resolution (no k6 globals)
- `load/lib/resolve.test.js` — node tests for resolve.js (`task load:test`)
- `load/lib/sessions.js` — optional session-pool reader
- `load/SPEC.md` — the design spec synthesized from the planning session
- `load/PRICING.md` — infrastructure + test-run cost model
- `docker-compose.load.yml` -- root compose service:runs these scenarios in k6 via Docker.
