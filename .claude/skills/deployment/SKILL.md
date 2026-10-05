---
name: deployment
description: >-
  How HARP is deployed and run in production and staging — the two Cloud Run
  services (prod deploys on a release tag, staging on every merge to main), the
  Cloudflare edge and Access in front of them, Neon/GCS/SuperTokens/SendGrid
  behind them, the staging copies of each (Neon branch, Mailtrap, separate
  SuperTokens, bucket, VAPID keys), the Dockerfile, how the Go binary serves
  the SPA and its cache headers, the service worker and stale-chunk recovery,
  env vars, database migrations against staging and prod, rollbacks, and
  deploy-time failure modes. Use this skill whenever someone asks how or where
  the app is deployed, what happens after a merge to main or a release, how to
  ship a migration or a new env var, how staging works or how to refresh it,
  how to roll back, why prod shows a blank page / "text/html is not a valid
  JavaScript MIME type" / a 404 on a chunk after a deploy, why the first
  request is slow, or whether a change is safe to deploy — even if they don't
  say "deploy" (e.g. "is it live yet?", "why isn't my merge in prod?", "prod is
  broken after the release", "do I need to run migrations?", "where do I set
  this secret?"). For CI checks, release-please, and git hooks, use the
  ci-pipeline skill instead.
---

# HARP Deployment

HARP ships as **one container** on Google Cloud Run. The same Go binary serves
the API, the SuperTokens auth routes, the compiled portal SPA, and the push
notification dispatcher. There is no separate frontend server, worker, or CDN
bucket.

The same image runs as two Cloud Run services in project `harp-489116`, region
`us-central1` **(console, not in repo)**:

| Service        | URL                               | Deploys on                         | `ENV`     |
| -------------- | --------------------------------- | ---------------------------------- | --------- |
| `harp`         | `https://harp.hackutd.co`         | a release tag (`vX.Y.Z`)           | `prod`    |
| `harp-staging` | `https://harp-staging.hackutd.co` | every push to `main`               | `staging` |

So **a merge to `main` is not live in prod.** It reaches prod with the next
release (see [Releasing to prod](#releasing-to-prod)).

This skill is a reference. Answer from it, cite the file each behavior comes
from, and **read the file again if the question hinges on a detail**, because
the code wins when the two disagree. Some of the setup lives in the GCP and
Cloudflare consoles, not in this repo. Those parts are flagged
**(console, not in repo)**. Say so when an answer depends on them, and don't
state them as verified fact.

## Repos and remotes

- `hackutd/harp` is both the open-source project and HackUTD's live
  deployment. Other schools copy it and restyle it; they don't track it.
  The old `hackutd/hackutd-harp` fork is archived.
- release-please runs here, guarded by
  `if: github.repository == 'hackutd/harp'` in `.github/workflows/release-please.yaml`
  so adopters' copies don't cut their own tags.
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

## Deploy triggers

Two Cloud Build triggers **(console, not in repo)**, both in region `global` on
the 1st-gen GitHub App connection to `hackutd/harp`. There is no
`cloudbuild.yaml`: each trigger's steps are inline. They build the `Dockerfile`
with `--no-cache` (every deploy re-downloads every Go module and npm package),
push it to `us-central1-docker.pkg.dev/harp-489116/cloud-run-source-deploy/`,
and run `gcloud run services update <_SERVICE_NAME> --image=…`.

| Trigger                                                         | Fires on                            | `_SERVICE_NAME` |
| --------------------------------------------------------------- | ----------------------------------- | --------------- |
| `rmgpgab-harp-us-central1-hackutd-harp--mavwd-prod`             | push new tag `^v\d+\.\d+\.\d+$` | `harp`          |
| `rmgpgab-harp-staging-us-central1-hackutd-harp--masow-staging`  | push to branch `^main$`             | `harp-staging`  |

Keep each trigger's build configuration **inline**. Switching it to
"Autodetected" or "Repository" makes it look for a `cloudbuild.yaml` that
doesn't exist, and it stops deploying.

### What happens on a merge to `main`

1. **CI** (`.github/workflows/audit.yaml`) runs the Go and portal checks. See the
   ci-pipeline skill.
2. The staging trigger deploys a new `harp-staging` revision. **Prod doesn't
   change.**
3. release-please updates its open release PR.
4. **Nothing runs migrations.** The container never touches the schema. See
   [Migrations](#migrations).

### Releasing to prod

Merging the release-please PR creates the `vX.Y.Z` tag, and the tag fires the
prod trigger. The tag points at the release commit, so `version.txt` (and
`/v1/health`) already carry the new version. Everything merged to `main` since
the last release ships together.

- **Urgent fix:** merge the fix, then merge the release PR straight away.
- **Redeploy an existing release** without cutting a new one: run the prod
  trigger by hand on that tag (Cloud Build → Triggers → Run, or
  `gcloud builds triggers run <prod trigger> --region=global --tag=vX.Y.Z`).

CI and Cloud Build are independent. Cloud Build never looks at CI, and it
starts in parallel with the post-merge CI run on `main`. The only gate is the
`protect-main` ruleset (GitHub settings), which requires `backend-audit` and
`frontend-audit` before a PR can merge. The `director-lead` team can bypass it,
and a bypass push deploys whatever it contains to staging, and to prod with the
next release. Don't assume a failing check kept bad code out.

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
and a console change (for the value), **on both services**. Set it on
`harp-staging` before merging and on `harp` before merging the release PR, when
the code would crash without it.

Secrets are Secret Manager references, not plain values: prod uses `DB_ADDR`,
`AUTH_BASIC_PASS`, `SUPERTOKENS_API_KEY`, `GOOGLE_CLIENT_SECRET`,
`VAPID_PRIVATE_KEY`, `SENDGRID_API_KEY` and `PUBLIC_API_KEY`. Prod runs as the
default compute service account.

## Staging

`harp-staging` is a full copy of prod's setup with **real data** and fake
delivery: its database is a branch of prod's, but nothing it sends reaches real
hackers. Every external service is a separate staging instance **(console, not
in repo)**:

| Piece          | Prod                          | Staging                                                    |
| -------------- | ----------------------------- | ---------------------------------------------------------- |
| Database       | Neon branch `production`      | Neon branch `staging`, a child of `production` (real data) |
| SuperTokens    | managed `st-prod-…`           | managed dev instance `st-dev-…`                            |
| Email          | SendGrid                      | Mailtrap **Email Sandbox** over SMTP (never delivers)      |
| Push           | prod VAPID keypair            | its own VAPID keypair                                      |
| GCS            | `harp_hackutd`                | `harp_hackutd_staging` (CORS for the staging origin)       |
| Google OAuth   | prod client                   | `harp_staging` client                                      |
| Secrets        | `DB_ADDR`, …                  | `STAGING_DB_ADDR`, `STAGING_AUTH_BASIC_PASS`, `STAGING_SUPERTOKENS_API_KEY`, `STAGING_GOOGLE_CLIENT_SECRET`, `STAGING_VAPID_PRIVATE_KEY`, `STAGING_EMAIL_PASSWORD` |
| Service account | default compute account      | `harp-staging@harp-489116.iam.gserviceaccount.com`         |
| Edge           | Cloudflare proxy              | Cloudflare proxy + **Access** (`@acmutd.co` via Google Workspace) |

What `ENV=staging` changes in the code: a sign-in whose SuperTokens ID the
database has never seen takes over the user with the same email and auth method
(`resolveEmailConflict` in `internal/auth/user_sync.go`, gated in
`cmd/api/middlewares.go`). That's what lets returning users, admins included,
sign in to a database copied from prod while the SuperTokens core is separate.
Nothing else reads `ENV` except the logger, which treats anything but
`development` as production.

The staging service account can read only the six `STAGING_*` secrets and the
staging bucket (`storage.objectAdmin`), plus `iam.serviceAccountTokenCreator` on
itself so it can sign resume upload/download URLs. It has no project-wide roles.

### Keep staging from reaching real people

Each of these looks harmless and isn't:

- **No `SENDGRID_API_KEY` on staging.** SendGrid wins over SMTP when both are
  set, and staging's database holds real hacker emails. Mailtrap's free plan
  also caps at 50 emails a month, so skip bulk decision sends on staging: once
  the cap is hit, magic links stop arriving too.
- **Never reuse prod's VAPID keys.** Staging's database has prod's push
  subscriptions and scheduled notifications; with prod's keys its dispatcher
  would push to real phones. With its own keys every send is rejected 401/403,
  and the dispatcher logs `all push sends failed VAPID auth; skipping prune`.
  That warning is expected on staging.
- **Never point staging at prod's bucket.** Deleting a user deletes their
  uploads by object path (`deleteUserAndIdentity` in `cmd/api/users.go`), and
  the paths in staging's database are prod's.
- **Never share prod's SuperTokens.** The same delete calls
  `supertokens.DeleteUser`, which would remove the person's prod identity and
  lock them out of prod.

### Access and its gaps

Cloudflare Access (Zero Trust, ACM UTD account) allows `@acmutd.co` through
Google Workspace. It only guards traffic that goes through Cloudflare: the
`run.app` URL skips it. Access seats are shared across all of ACM's Access apps
(50 on the free plan). When they run out, people see "Your Cloudflare Access
organization has used all of its available seats"; free seats under
Zero Trust → Team & Resources → Users.

To sign in to HARP on staging, use Google, or request a magic link and open it
from the Mailtrap sandbox inbox.

### Refreshing staging's data

```
neon branches reset staging --parent
```

or Reset from parent in the Neon console. This replaces staging's data and
schema with prod's current state, so afterwards re-apply any migrations that
are on `main` but not yet released (`task migrate-up` against staging).

## Migrations

Migrations are SQL files in `cmd/migrate/migrations/`, applied with
golang-migrate. **The deployed container never runs them.** Someone applies
them by hand, against staging first and prod second:

```
DB_ADDR='<staging branch direct url>' task migrate-up   # before merging the PR
DB_ADDR='<production branch direct url>' task migrate-up # before merging the release PR
```

Use Neon's **direct** (non-pooler) connection string for migrations, and check
the host belongs to the branch you mean before running anything. The staging
and production URLs look almost identical.

Ordering rule: **the schema has to be ready before the code that needs it goes
live.** The PR's merge puts the code on staging, and the release puts it on
prod, so an additive migration (new table, nullable column) goes to staging
before the PR merges and to prod before the release PR merges. Old code ignores
the extra schema, and new code finds it on its first request. Running it on
staging first is also the dry run against real data.

A destructive change (drop or rename a column, add NOT NULL without a default)
takes two releases. First release code that no longer depends on the old shape,
then migrate.

Run `task migrate-check` to validate numbering and up/down pairs. Read
`cmd/migrate/migrations/README.md` before renumbering anything that is already
applied to a live database.

**Never apply or roll back a migration against prod on your own.** That touches
live hacker data. Give the user the command and let them run it.

## Rollback

Cloud Run keeps earlier revisions. Rolling back means sending 100% of traffic
to a previous revision, from the Cloud Run console or with
`gcloud run services update-traffic harp --region=us-central1 --to-revisions=<rev>=100`
(`harp-staging` for staging).

- A rollback puts the old image back. It does **not** undo migrations. Old code
  has to tolerate the current schema, which the additive-first rule above
  guarantees.
- Clients recover through the same stale-chunk path as a forward deploy.
- Redeploying an older release also works: run the prod trigger on that tag.
- A revert commit on `main` only reaches staging. It gets to prod with the next
  release, after a full `--no-cache` rebuild.

## Verifying a deploy

- `GET /v1/health` with Basic auth returns `version` (from `version.txt`), `env`
  (`prod` or `staging`), and `database: ok`. A `503` with `database: unreachable` means the DB is
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
| 500 on a new feature, logs show `column/relation does not exist`        | the code deployed before its migration. Run `task migrate-up` against that service's Neon branch |
| Merged, but not in prod                                                 | expected: `main` deploys staging only. Merge the release-please PR to ship it                  |
| Staging sign-in fails with `unexpected state: same email and auth method but different supertokens id` | `ENV` on `harp-staging` isn't exactly `staging`, so re-linking is off               |
| Staging magic links stop arriving                                       | Mailtrap's monthly cap (50 on free) is used up. Sign in with Google, or wait or upgrade        |
| "Your Cloudflare Access organization has used all of its available seats" | ACM's Zero Trust seats are full. Remove inactive users under Team & Resources → Users        |
| Google button missing or present when it shouldn't be                   | `VITE_GOOGLE_AUTH_ENABLED` is baked into the image; it needs a rebuild, not an env change       |
| Everyone at the venue gets 429                                          | the IP limiter sees one address. Check that `CLIENT_IP_HEADER` matches the proxy, or raise `RATELIMITER_IP_REQUESTS_COUNT` |
| Scheduled push arrived late or shows failed                             | no instance was alive when it came due (scale-to-zero). See `DISPATCHER_MAX_LATENESS_MINUTES`   |
| Resume upload fails in prod                                             | `GCS_BUCKET_NAME` unset, or the service account lacks bucket access                            |
| Slow first request after a quiet period                                 | Cloud Run cold start plus Neon waking up                                                       |
| Build fails at `go mod download` with `stream error ... INTERNAL_ERROR` | proxy.golang.org flake. The Dockerfile retries 3×, so rerun the build                          |

## Things not to do

- Don't add a `cloudbuild.yaml` or a GitHub Actions deploy job on a hunch. The
  real triggers are in GCP, and a second pipeline would double-deploy.
- Don't set `SENDGRID_API_KEY`, prod's VAPID keys, prod's bucket, or prod's
  SuperTokens on staging. See [Keep staging from reaching real people](#keep-staging-from-reaching-real-people).
- Don't add a fallback to `index.html` for missing asset files.
- Don't move static assets to GCS or a CDN bucket without handling the
  `/assets/*` immutable-cache and 404 contract.
- Don't change the shape of `/v1/public/*` without updating `harp-marketing` in
  the same sitting.
- Don't run migrations (staging or prod), rollbacks, branch resets, or console
  changes yourself. Prepare them and hand them over.
