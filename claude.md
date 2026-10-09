# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HARP** (Hacker Applications & Review Platform) — a hackathon management system built so any school can run it. Go backend + React frontend. Supports hacker applications, admin review/grading workflows, and super-admin configuration.

One frontend lives under `client/`:

- `client/portal/` — the year-round application/review SPA (Vite + React). Built into the Go container and served from `/`.

The public marketing site lives in a **separate repository** (`hackutd/harp-marketing`). It is redesigned per hackathon, deployed independently to Vercel, and consumes `/v1/public/*` with an API key. It is not part of this repo or the Docker build.

Local dev ports: backend `8080`, portal `3000`. Port 3000 is pinned for the portal by `FRONTEND_URL` and the SuperTokens `WebsiteDomain`, so the marketing site takes 3001 when run alongside.

## Working Style

- **Fix the code, don't build a test rig.** Diagnose from the source, make the change, and hand it back. The maintainer runs the app and verifies visually themselves.
- Do not scaffold throwaway harness pages, mock-API entry points, or browser-automation scripts inside this repo to prove a UI change works.
- Existing checks are enough: `task test` for Go, `npm run build` / `npm run lint` for the portal.

## Commands

### Backend (Go)

| Command                            | Description                                |
| ---------------------------------- | ------------------------------------------ |
| `air`                              | Start backend with hot reload (port 8080)  |
| `go build -o ./tmp/main ./cmd/api` | Build the API binary                       |
| `task test`                        | Run all Go tests (`go test -v ./...`)      |
| `task gen-docs`                    | Regenerate Swagger docs                    |
| `task migrate-up`                  | Apply all DB migrations                    |
| `task migrate-down`                | Roll back one migration                    |
| `task migrate-goto -- <version>`   | Migrate up or down to a specific version   |
| `task migrate-create -- <name>`    | Create a new migration                     |
| `task seed`                        | Run DB seed script                         |
| `task setup-hooks`                 | Configure git hooks (run once after clone) |
| `docker-compose up -d`             | Start PostgreSQL                           |
| `staticcheck ./...`                | Run static analysis (checked in CI)        |

Note: `air` runs `task gen-docs` as a pre-command on every rebuild, so `swag` CLI must be installed.

### Frontend (`client/portal/`)

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start Vite dev server (port 3000)        |
| `npm run build`         | TypeScript check + Vite production build |
| `npm run lint`          | Run ESLint                               |
| `npm run format`        | Auto-format with Prettier                |
| `npm run format:check`  | Check formatting (runs in CI)            |
| `npm test`              | Run Vitest unit tests once (runs in CI)  |
| `npm run test:watch`    | Run Vitest in watch mode                 |
| `npm run test:coverage` | Run Vitest with a coverage report        |

Unit tests sit beside their source as `<name>.test.ts(x)`; conventions are in `client/portal/README.md`.

### Dev Tool Prerequisites

`air`, `swag` (Swagger codegen), `task` (Taskfile runner), `migrate` CLI (golang-migrate) — install via `go install`. `staticcheck` is also used in CI.

## Architecture

### Backend (Go + Chi)

- **Entry point:** `cmd/api/main.go` — loads config, `cmd/api/api.go` — Chi router setup in `mount()`
- **Database:** PostgreSQL 16.3, raw SQL (no ORM), repository pattern in `internal/store/`
- **Auth:** SuperTokens (Passwordless magic link + Google OAuth), initialized in `internal/auth/`
- **Middleware chain:** RequestID → ClientIP → Logger → Recoverer → CORS → SuperTokens → RateLimiter (`/v1` only) → AuthRequired → RequireRole
- **Rate limiting:** keyed by SuperTokens user ID when the request carries a verified session (`RATELIMITER_REQUESTS_COUNT`), falling back to client IP otherwise (`RATELIMITER_IP_REQUESTS_COUNT`, larger because a whole venue shares one NAT). The client IP comes from `CLIENT_IP_HEADER` (default `CF-Connecting-IP`) or `CLIENT_IP_TRUSTED_PROXIES` hops into `X-Forwarded-For`; other forwarded headers are ignored. Static assets and `/auth/*` are never limited.
- **Roles (hierarchical):** `hacker` (1) < `admin` (2) < `super_admin` (3)
- **JSON envelope:** Success: `{"data": ...}`, Error: `{"error": "..."}`
- **Pagination:** Cursor-based with base64-encoded JSON cursors
- **Migrations:** SQL files in `cmd/migrate/migrations/`, managed with `golang-migrate`

#### Migration Naming Convention

Format: `{6-digit-number}_{action}_{subject}.{up|down}.sql`

- `create` — foundational schema objects (infrastructure, core tables, initial types)
- `add` — new features, tables, columns, or triggers added after initial setup
- `alter` — modifications to existing schema objects
- `seed` — initial/default data insertion

Each migration must be isolated to one concern — one table, one type, or one logical operation. Triggers and indexes stay with their parent table. Enum types get their own migration, separate from the table that uses them.

#### Go Handler Pattern

Handlers are methods on `*application`:

- Get user: `getUserFromContext(r.Context())`
- Parse body: `readJSON(w, r, &payload)`, validate: `Validate.StructCtx(r.Context(), payload)`
- Success: `app.jsonResponse(w, http.StatusOK, data)` — wraps in `{"data": ...}`
- Errors: `app.internalServerError`, `app.badRequestResponse`, `app.notFoundResponse`, `app.forbiddenResponse`, `app.conflictResponse`, `app.unauthorizedErrorResponse`
- Query timeout: `context.WithTimeout(ctx, store.QueryTimeoutDuration)` (5s)
- Store errors: check `store.ErrNotFound` and `store.ErrConflict` via `errors.Is()`

#### Go Testing Pattern

Tests live in `cmd/api/` (`_test.go` files, same package as handlers):

- `newTestApplication(t)` — creates app with `store.MockStore` (testify/mock, defined in `internal/store/mock_store.go`)
- `executeRequest(req, mux)` — sends request through full router
- `setUserContext(req, user)` — injects user into context (bypasses auth)
- Helper constructors: `newTestUser()`, `newAdminUser()`, `newSuperAdminUser()`
- SuperTokens must be initialized even for handler tests (`initTestSuperTokens`)

#### Internal Packages

- `internal/store/` — repository pattern, all DB queries
- `internal/env/` — typed env var helpers (`GetString`, `GetInt`, `GetBool`, `GetRequiredString`)
- `internal/db/` — PostgreSQL connection setup (pgx)
- `internal/mailer/` — SendGrid email with embedded Go templates
- `internal/auth/` — SuperTokens init, user creation from session
- `internal/ratelimiter/` — fixed-window rate limiter (one instance per user-ID bucket, one per IP bucket)
- `internal/logger/` — Zap logger (dev/prod modes based on `ENV`)

### Frontend (React 19 + TypeScript + Vite)

- **UI:** Tailwind CSS v4 + shadcn/ui (New York style, Radix-based, Tabler icons via `@tabler/icons-react`)
- **Routing:** React Router v7, guards in `shared/auth/guards/`
- **State:** Zustand — global stores in `shared/stores/`, page-local stores co-located in page directories
- **Forms:** React Hook Form + Zod validation
- **Auth client:** `supertokens-auth-react`

### Public content API (consumed by the marketing site)

The marketing site is a **separate repository** (`hackutd/harp-marketing`, Next.js). It is not built, tested, or deployed from here. What matters in this repo is the contract it depends on:

- `/v1/public/{schedule,sponsors,faq}` sits behind `APIKeyMiddleware` (`cmd/api/api.go`), which compares an `X-API-Key` header against `PUBLIC_API_KEY`. These routes need no user session but are **not** unauthenticated — the key is a shared secret.
- The marketing repo's `lib/types.ts` mirrors the Go structs in `internal/store/`. That coupling now spans two repositories and nothing here will catch a drift: **changing the shape of a `/v1/public/*` response is a breaking change for the marketing site**, so update it in the same sitting.
- Sponsor logos ship as raw base64 in `logo_data` plus `logo_content_type`, not URLs — so the sponsors payload grows with every sponsor.

### Frontend-Backend Connection

Vite dev server proxies `/v1/*` and most `/auth/*` to Go backend (port 8080). Frontend auth routes (`/auth/callback`, `/auth/verify`, `/auth/callback/google`) are excluded from proxy.

## Frontend Conventions

### Path Aliases

`@/*` → `./src/*`, also `@/components/*`, `@/shared/*`, `@/layouts/*`, `@/pages/*`

### Import Boundaries (enforced by `eslint-plugin-boundaries`)

- `shared/` can only import from `shared/`
- `components/` can import from `shared/`, `components/`
- `layouts/` can import from `shared/`, `components/`, `pages/` (for shared admin components in `pages/admin/_shared/`)
- `pages/` can import from anything
- **Blocked imports:** `@/lib/*`, `@/hooks/*`, `@/stores/*`, `@/features/*` — use `@/shared/*` instead
- Deep imports into `@/shared/auth/*/*` are blocked — use barrel export from `@/shared/auth`

### Key Patterns

- **API client:** All HTTP through `shared/lib/api.ts` (`getRequest<T>`, `postRequest<T>`, etc.) — never use `fetch` directly. Returns `ApiResponse<T>` with `{ status, data?, error? }`. All requests include `credentials: "include"`.
- **Page structure:** Page-specific stores, api modules, types, and components are co-located within the page directory (e.g., `pages/admin/all-applicants/{store,api,types,components}/`)
- **Admin shared components:** `pages/admin/_shared/` for sidebar, nav components shared across admin pages
- **shadcn/ui components:** Live in `components/ui/` — do not duplicate or add competing UI libraries

### ESLint Rules

- `eslint-plugin-simple-import-sort` enforces import ordering
- Unused variables must be prefixed with `_`
- TypeScript strict mode enabled

## CI Pipeline

Runs on every push/PR to `main` (`.github/workflows/audit.yaml`):

- **Path filter (`changes`):** on PRs, Go jobs run only when Go/backend files change and `frontend-audit` only when `client/portal/` changes; skipped jobs count as passed. Pushes to `main` run everything. A new push to a PR cancels its previous run.
- **Go tests (`backend-audit`):** `go test -race ./...`
- **Go lint (`backend-lint`):** migration naming check, gofmt check, `go mod verify`, `go vet`, `staticcheck`, `govulncheck`, Swagger docs drift check (`task gen-docs` must leave no diff)
- **DB (`db-integration`):** throwaway Postgres 16.3 service container; migrations `up` → `down -all` → `up`, then the store integration tests with `HARP_TEST_DSN` set
- **Image (`docker-build`):** builds the production `Dockerfile` without pushing
- **Portal (`frontend-audit`):** `npm run format:check`, `npm run lint`, `npm run build`, `npm audit --audit-level=high`, `npm run test:reviews`, `npm run test:applications`, `npm run test:auth`, `npm test` (Vitest)

PRs that change `cmd/migrate/migrations/` also get a reminder comment (`.github/workflows/migration-reminder.yaml`) to apply the migration to staging before merging and to prod before the release.

## Deployment & Infrastructure

- **CI:** GitHub Actions (`.github/workflows/audit.yaml`) runs on every push/PR to `main` — jobs: `changes`, `backend-audit`, `backend-lint`, `db-integration`, `docker-build`, `frontend-audit` (portal)
- **CD:** Google Cloud Build → Google Cloud Run, two triggers (in GCP, not in repo):
  - **Staging:** every push to `main` deploys `harp-staging` (`https://harp-staging.hackutd.co`)
  - **Prod:** a release tag `vX.Y.Z` deploys `harp` (`https://harp.hackutd.co`). Merging the release-please PR creates the tag, so **a merge to `main` is not live in prod until the next release**
- **Staging:** `ENV=staging`, real data on a Neon branch of prod (refresh with `neon branches reset staging --parent`), separate SuperTokens, Google OAuth client, GCS bucket and VAPID keys, email through a Mailtrap sandbox, behind Cloudflare Access (`@acmutd.co`). **Never give staging `SENDGRID_API_KEY` or any prod credential** — it holds real hacker emails and push subscriptions. Details in the `deployment` skill
- **Migrations:** never run by a deploy. Apply to staging before merging the PR, and to prod before merging the release PR
- **Container:** Multi-stage `Dockerfile` — builds frontend (Node 22), builds Go binary, runs from `scratch` image on port 8080. Frontend is compiled at build time and served as static files
- **Database:** Neon DB (managed PostgreSQL); branch `production` for prod, child branch `staging` for staging
- **File Storage:** Google Cloud Storage (GCS)
- **Auth:** SuperTokens (self-hosted or managed, free tier: 5,000 MAUs) — Passwordless + Google OAuth
- **Email:** SendGrid (prod), Mailtrap Email Sandbox over SMTP (staging)
- **Marketing site:** its own repository (`hackutd/harp-marketing`) and its own Vercel project — not part of this repo or the Cloud Run deploy

## Git Conventions

- **Commit messages:** Use [Conventional Commits] format (e.g., `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)
- Keep commit messages short (subject line under 72 characters)
- **Never** include `Co-Authored-By` lines in commit messages
- Run `task setup-hooks` once after cloning to enable the local `commit-msg` hook that validates Conventional Commits
- PR titles are validated in CI (`.github/workflows/conventional-commits.yaml`) and must follow Conventional Commits, since the squash-merge commit (and release-please) uses the PR title

## API Routes

**Auth:** `GET /v1/auth/check-email`, `GET /v1/auth/me`
**Unauthenticated:** `POST /v1/referrals/{code}/visit` (counts a landing on a `/?s=<code>` referral link; rate-limited by IP)
**Hacker:** `GET|PATCH /v1/applications/me`, `POST /v1/applications/me/submit`, `GET /v1/points-config`, `DELETE /v1/users/me`, `PATCH /v1/users/me/theme` (light/dark portal theme, any role; defaults to dark), `GET|PUT|DELETE /v1/users/me/photo`, `POST /v1/users/me/photo-upload-url` (one profile photo, shown on the profile and in the sidebar; falls back to the Google picture)
**Admin:** `GET /v1/admin/settings/priority-deadline` (null when unset; drives the Priority badge), `GET /v1/admin/applications`, `GET /v1/admin/applications/stats`, `GET /v1/admin/applications/{id}`, `GET /v1/admin/applications/{id}/notes`, `GET /v1/admin/reviews/pending`, `GET /v1/admin/reviews/completed`, `GET /v1/admin/reviews/leaderboard`, `POST /v1/admin/reviews/claim`, `PUT /v1/admin/reviews/{id}`, `GET /v1/admin/scans/types`, `POST /v1/admin/scans`, `GET /v1/admin/scans/user/{userID}`, `GET /v1/admin/scans/stats`, `POST /v1/admin/scans/rebalance-stats`
**Super Admin:** `GET|PUT /v1/superadmin/settings/saquestions`, `GET|POST /v1/superadmin/settings/reviews-per-app`, `GET|POST /v1/superadmin/settings/review-assignment-toggle`, `GET|POST /v1/superadmin/settings/admin-schedule-edit-toggle`, `GET|PUT /v1/superadmin/settings/priority-deadline` (GET/PUT also return per-status counts of applications submitted by it), `POST /v1/superadmin/applications/assign`, `PATCH /v1/superadmin/applications/{id}/status`, `PATCH /v1/superadmin/applications/{id}`, `POST /v1/superadmin/applications/{id}/resume-upload-url`, `DELETE /v1/superadmin/applications/{id}/resume`, `GET /v1/superadmin/applications/emails`, `PUT /v1/superadmin/settings/scan-types`, `POST /v1/superadmin/settings/points-name`, `GET|POST /v1/superadmin/settings/points-enabled`, `POST /v1/superadmin/scans/rebalance-stats`, `GET|POST /v1/superadmin/decisions/releases` (decision release waves; hackers only see released decisions), `GET /v1/superadmin/decisions/releases/preview`, `POST /v1/superadmin/decisions/releases/{id}/undo` (most recent release in effect only), `POST /v1/superadmin/emails/decisions` (released decisions only), `GET /v1/superadmin/emails/decisions/stats`, `GET /v1/superadmin/walk-ins`, `POST /v1/superadmin/walk-ins/promote`, `GET|POST /v1/superadmin/referrals`, `PUT|DELETE /v1/superadmin/referrals/{id}`, `GET /v1/superadmin/referrals/{id}/signups`
**Infra (Basic Auth):** `GET /v1/health`, `GET /v1/debug/vars`, `GET /v1/swagger/*`
