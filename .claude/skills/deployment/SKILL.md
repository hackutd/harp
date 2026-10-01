---
name: deployment
description: >-
  How HARP is deployed and run in production — the single Cloud Run container,
  the Cloudflare edge in front of it, Neon/GCS/SuperTokens/SendGrid behind it,
  the Dockerfile, how the Go binary serves the SPA and its cache headers, the
  service worker and stale-chunk recovery, production env vars, database
  migrations against prod, rollbacks, and deploy-time failure modes. Use this
  skill whenever someone asks how or where the app is deployed, what happens
  after a merge to main, how to ship a migration or a new env var, how to roll
  back, why prod shows a blank page / "text/html is not a valid JavaScript MIME
  type" / a 404 on a chunk after a deploy, why the first request is slow, or
  whether a change is safe to deploy — even if they don't say "deploy" (e.g.
  "is it live yet?", "prod is broken after the merge", "do I need to run
  migrations?", "where do I set this secret?"). For CI checks, release-please,
  and git hooks, use the ci-pipeline skill instead.
---

# HARP Deployment

HARP ships as **one container** on Google Cloud Run. The same Go binary serves
the API, the SuperTokens auth routes, the compiled portal SPA, and the push
notification dispatcher. There is no separate frontend server, worker, or CDN
bucket.

This skill is a reference. Answer from it, cite the file each behavior comes
from, and **read the file again if the question hinges on a detail**, because
the code wins when the two disagree. Some of the setup lives in the GCP and
Cloudflare consoles, not in this repo. Those parts are flagged
**(console, not in repo)**. Say so when an answer depends on them, and don't
state them as verified fact.

## Repos and remotes

- This checkout's `origin` is `hackutd/hackutd-harp`, HackUTD's own copy.
  `upstream` is `hackutd/harp`, the open-source project other schools adopt.
- release-please runs **only on upstream**, guarded by
  `if: github.repository == 'hackutd/harp'` in `.github/workflows/release-please.yaml`.
  `version.txt` changes here only when upstream is merged in.
- The marketing site (`hackutd/harp-marketing`, Next.js on Vercel) is a
  separate deployment. It reads `/v1/public/*` with `PUBLIC_API_KEY`. Changing
  the shape of those responses breaks it (see CLAUDE.md).

## Topology

```
browser
  → Cloudflare          proxied DNS, TLS, edge cache         (console, not in repo)
  → Cloud Run           one container, :8080                 (console, not in repo)
      ├── Neon          PostgreSQL           DB_ADDR
      ├── GCS           resume uploads only  GCS_BUCKET_NAME
      ├── SuperTokens   managed core         SUPERTOKENS_CONNECTION_URI / _API_KEY
      └── SendGrid      email                SENDGRID_API_KEY (or SMTP)
```

## What happens on a merge to `main`

1. **CI** (`.github/workflows/audit.yaml`) runs the Go and portal checks. See the
   ci-pipeline skill.
2. **Cloud Build** builds the `Dockerfile` and deploys a new Cloud Run revision
   **(console, not in repo)**. There is no `cloudbuild.yaml`. The trigger and its
   flags live in GCP. The Dockerfile comment says the trigger builds with
   `--no-cache`, so every deploy re-downloads every Go module and npm package.
3. **Nothing runs migrations.** The container never touches the schema. See
   [Migrations](#migrations).

CI and Cloud Build are independent. As far as this repo shows, a red CI run
does **not** stop the deploy. Don't assume a failing check kept bad code out of
prod.

## The image (`Dockerfile`)

| Stage      | Base                   | Does                                                                                                                                                    |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend` | `node:22.23.1-alpine`  | `npm ci` + `npm run build` in `client/portal`. Build arg `VITE_GOOGLE_AUTH_ENABLED` (default `true`) is **baked in at build time**.                      |
| `builder`  | `golang:1.27.1`        | `go mod download` with HTTP/1.1 + `GOMAXPROCS=4` + 3 retries (works around proxy.golang.org stream resets from Cloud Build), then a static `CGO_ENABLED=0` build with `-X main.version=$(cat version.txt)`. |
| final      | `scratch`              | CA certs, `./api`, portal `dist` → `./static`, plus `pwa-192x192.png` (the Apple Wallet icon default path) and the zero-day title image for emails. `EXPOSE 8080`. |

Consequences:

- `scratch` means **no shell** in the container. `gcloud run ... exec`-style
  debugging and `sh -c` entrypoints won't work. Look at logs instead.
- Any `VITE_*` value is fixed when the image is built. Changing it on the Cloud
  Run service does nothing. It needs a rebuild with a different build arg.
- The reported version (`/v1/health`, startup log, `/v1/debug/vars`) is
  `version.txt`. A local `go build` without the ldflag reports `dev`.

## Serving model (`cmd/api/spa.go`, `cmd/api/api.go`)

| Request                                  | Response                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| `/v1/*`                                  | API (rate-limited). `/v1/health`, `/v1/debug/vars`, `/v1/swagger/*` need HTTP Basic auth |
| `/auth/*`                                | SuperTokens                                                 |
| `/assets/*` that exists                  | `Cache-Control: public, max-age=31536000, immutable`        |
| any other existing file (`sw.js`, manifest, icons) | `no-cache`                                        |
| missing path **with** an extension       | real `404`, `no-store`                                      |
| missing path **without** an extension    | SPA fallback to `index.html`, `no-cache`                    |

The missing-file 404 is deliberate (see the comment in `spa.go`). Falling back
to `index.html` for a `.js` URL used to hand browsers HTML as a module script,
and Cloudflare cached that bad response at the edge for everyone behind it.
**Don't "fix" asset 404s by adding a fallback.**

## Deploy-time client behavior

Each deploy ships a new image, so the previous build's content-hashed
`/assets/*` files are gone.

- **Stale chunks.** A tab or installed PWA opened before the deploy still
  references old chunk names. Lazy routes then 404.
  `client/portal/src/shared/lib/stale-chunk-reload.ts`, installed in `main.tsx`,
  catches `vite:preloadError` and reloads once. It waits 10 s before reloading
  again, so a real failure shows up instead of looping.
- **Service worker** (`client/portal/src/sw.ts`, `vite.config.ts`). It uses
  `injectManifest` with `registerType: "autoUpdate"`, and the SW calls
  `skipWaiting()` and `clients.claim()`. It **precaches** everything that matches
  `**/*.{js,css,html,png,svg,ico,webp,woff,woff2}`, which **includes
  `index.html`**. There are no runtime-caching routes. Its job is push
  notifications plus the precache. After a deploy, the new SW replaces the old
  precache on its next update check.
- **Cold starts.** A reload that lands while an instance is starting can fail
  once. The next reload succeeds.

## Scale-to-zero and background work

Cloud Run min-instances and Neon autosuspend are **(console, not in repo)**.
The code assumes instances can come and go:

- The push dispatcher (`cmd/api/dispatcher.go`) is a goroutine started in
  `main.go`. It runs only while an instance is alive, and only if both
  `VAPID_*` keys are set. It sweeps once at startup and then every tick, and it
  claims rows with a lease so a replaced instance's work is picked up again.
- **Footgun.** If the service is at zero instances when a notification comes due,
  nothing sends it until traffic wakes an instance. Anything later than
  `DISPATCHER_MAX_LATENESS_MINUTES` (default 30) is marked failed, not sent.
  During an event this rarely matters because traffic keeps instances up. For a
  notification scheduled in a quiet period, it can.
- Shutdown on SIGTERM (`run()` in `cmd/api/api.go`) cancels the dispatcher, gives
  in-flight requests 5 s, then drains request-spawned background jobs within the
  same deadline.
- Session state lives in SuperTokens and rate-limit counters are in memory per
  instance. The rate limit is therefore per instance, not global.
- When Neon is suspended, the first query pays its wake-up latency.

## Production configuration

All config is env vars on the Cloud Run service **(console, not in repo)**. The
list and defaults are in `.env.example` and `cmd/api/main.go`. A missing
`.env` file is normal in prod.

**The process exits at startup (`Fatal`) if any of these is missing:**

- `AUTH_BASIC_USER`, `AUTH_BASIC_PASS` (`env.GetRequiredString`)
- `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY` (`env.GetRequiredString`)
- an email provider: `SENDGRID_API_KEY` **or** the SMTP set (`EMAIL_HOST`, …).
  `mailer.New` fails otherwise.
- a reachable database at `DB_ADDR`. The default points at localhost, so prod
  must override it.
- valid Apple Wallet material, but only if `APPLE_WALLET_ENABLED=true`

**Must be right, or sign-in breaks.** `APP_URL` must be the public origin.
`FRONTEND_URL` defaults to `APP_URL`, which is correct in prod because the SPA
is same-origin. Leave it unset or equal to `APP_URL`. SuperTokens builds its
callbacks from both.

**Must match the edge.** `CLIENT_IP_HEADER=CF-Connecting-IP` (the default) is
correct only while Cloudflare is proxying. If the service is ever exposed
without Cloudflare, anyone can spoof that header and dodge the per-IP limiter.
In that case, clear it and set `CLIENT_IP_TRUSTED_PROXIES` instead.

**Set once, don't rotate.** Rotating `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
invalidates every browser push subscription. `HACKATHON_NAME` seeds the GCS
resume prefix `hackathons/<slug>/resumes/`.

**Optional, feature off when empty:** `GCS_BUCKET_NAME` (resume upload
disabled), `PUBLIC_API_KEY` (public routes disabled), `GOOGLE_CLIENT_*` (no
Google sign-in), `VAPID_*` (no push). On Cloud Run, GCS uses the attached
service account, so `GOOGLE_APPLICATION_CREDENTIALS` stays unset.
`GOOGLE_CLOUD_PROJECT` is read from the metadata server, and `K_SERVICE`
overrides `SERVICE_NAME`.

Changing an env var on the service creates a new revision **without** a
rebuild. Adding a *new* env var to the code needs both a merge (for the code)
and a console change (for the value). Do the console change first when the
code would crash without it.

## Migrations

Migrations are SQL files in `cmd/migrate/migrations/`, applied with
golang-migrate. **The deployed container never runs them.** Someone applies
them by hand against Neon:

```
DB_ADDR='<neon url>' task migrate-up
```

Ordering rule: **the schema has to be ready before the code that needs it goes
live.** Apply additive migrations (new table, nullable column) before merging.
Old code ignores the extra schema, and new code finds it on its first request.
A destructive change (drop or rename a column, add NOT NULL without a default)
takes two deploys. First ship code that no longer depends on the old shape,
then migrate.

Run `task migrate-check` to validate numbering and up/down pairs. Read
`cmd/migrate/migrations/README.md` before renumbering anything that is already
applied to a live database.

**Never apply or roll back a migration against prod on your own.** That touches
live hacker data. Give the user the command and let them run it.

## Rollback

Cloud Run keeps earlier revisions. Rolling back means sending 100% of traffic
to a previous revision, from the Cloud Run console or with
`gcloud run services update-traffic <service> --to-revisions=<rev>=100`
**(console, not in repo; service and region names aren't in the repo, so ask)**.

- A rollback puts the old image back. It does **not** undo migrations. Old code
  has to tolerate the current schema, which the additive-first rule above
  guarantees.
- Clients recover through the same stale-chunk path as a forward deploy.
- A revert commit on `main` also works, but it waits for a full `--no-cache`
  rebuild.

## Verifying a deploy

- `GET /v1/health` with Basic auth returns `version` (from `version.txt`), `env`,
  and `database: ok`. A `503` with `database: unreachable` means the DB is
  unreachable (a bad `DB_ADDR` or Neon down).
- The startup log line `starting` includes `version`, `env`, and `gcp_project`.
  Then look for `db connection established`, `supertokens initialized`, and
  `push dispatcher started` or `disabled`. A `Fatalw` just before exit names the
  missing piece.
- Prod logs are Cloud Logging JSON with request/trace correlation. Panics and
  500s show up in Error Reporting.
- The maintainer verifies the UI themselves (see CLAUDE.md). Don't build
  harness pages or scripts to prove a deploy works.

## Symptom → cause

| Symptom                                                                 | Likely cause                                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "text/html is not a valid JavaScript MIME type" after a deploy          | a fallback to `index.html` came back for a `.js` URL, or Cloudflare cached one. Check `spa.go`; purge the URL at Cloudflare |
| Lazy route errors once right after a deploy, then works                 | stale chunk. Expected; the reload handled it                                                   |
| Sign-in redirects to the wrong host or loops                            | `APP_URL` / `FRONTEND_URL` don't match the public origin                                       |
| Revision fails to start                                                 | a required env var is missing, there's no email provider, or the DB is unreachable. Read the `Fatalw` line |
| 500 on a new feature, logs show `column/relation does not exist`        | the code deployed before its migration. Run `task migrate-up` against Neon                     |
| Google button missing or present when it shouldn't be                   | `VITE_GOOGLE_AUTH_ENABLED` is baked into the image; it needs a rebuild, not an env change       |
| Everyone at the venue gets 429                                          | the IP limiter sees one address. Check that `CLIENT_IP_HEADER` matches the proxy, or raise `RATELIMITER_IP_REQUESTS_COUNT` |
| Scheduled push arrived late or shows failed                             | no instance was alive when it came due (scale-to-zero). See `DISPATCHER_MAX_LATENESS_MINUTES`   |
| Resume upload fails in prod                                             | `GCS_BUCKET_NAME` unset, or the service account lacks bucket access                            |
| Slow first request after a quiet period                                 | Cloud Run cold start plus Neon waking up                                                       |
| Build fails at `go mod download` with `stream error ... INTERNAL_ERROR` | proxy.golang.org flake. The Dockerfile retries 3×, so rerun the build                          |

## Things not to do

- Don't add a `cloudbuild.yaml` or a GitHub Actions deploy job on a hunch. The
  real trigger is in GCP, and a second pipeline would double-deploy.
- Don't add a fallback to `index.html` for missing asset files.
- Don't move static assets to GCS or a CDN bucket without handling the
  `/assets/*` immutable-cache and 404 contract.
- Don't change the shape of `/v1/public/*` without updating `harp-marketing` in
  the same sitting.
- Don't run prod migrations, rollbacks, or console changes yourself. Prepare
  them and hand them over.
