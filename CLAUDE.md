# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HARP** (Hacker Applications & Review Platform) — a hackathon management system for HackUTD. Go backend + React frontend. Supports hacker applications, admin review/grading workflows, and super-admin configuration.

## Commands

### Backend (Go)

| Command                            | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `air`                              | Start backend with hot reload (port 8080) |
| `go build -o ./tmp/main ./cmd/api` | Build the API binary                      |
| `task test`                        | Run all Go tests (`go test -v ./...`)     |
| `task gen-docs`                    | Regenerate Swagger docs                   |
| `task migrate-up`                  | Apply all DB migrations                   |
| `task migrate-down`                | Roll back one migration                   |
| `task migrate-create -- <name>`    | Create a new migration                    |
| `task seed`                        | Run DB seed script                        |
| `task setup-hooks`                 | Configure git hooks (run once after clone) |
| `docker-compose up -d`             | Start PostgreSQL                          |
| `staticcheck ./...`                | Run static analysis (checked in CI)       |

Note: `air` runs `task gen-docs` as a pre-command on every rebuild, so `swag` CLI must be installed.

### Frontend (`client/web/`)

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start Vite dev server (port 3000)        |
| `npm run build`      | TypeScript check + Vite production build |
| `npm run lint`       | Run ESLint                               |
| `npm run format`     | Auto-format with Prettier                |
| `npm run format:check` | Check formatting (runs in CI)          |

### Dev Tool Prerequisites

`air`, `swag` (Swagger codegen), `task` (Taskfile runner), `migrate` CLI (golang-migrate) — install via `go install`. `staticcheck` is also used in CI.

## Architecture

### Backend (Go + Chi)

- **Entry point:** `cmd/api/main.go` — loads config, `cmd/api/api.go` — Chi router setup in `mount()`
- **Database:** PostgreSQL 16.3, raw SQL (no ORM), repository pattern in `internal/store/`
- **Auth:** SuperTokens (Passwordless magic link + Google OAuth), initialized in `internal/auth/`
- **Middleware chain:** RequestID → RealIP → Logger → Recoverer → CORS → SuperTokens → RateLimiter → AuthRequired → RequireRole
- **Roles (hierarchical):** `hacker` (1) < `admin` (2) < `super_admin` (3)
- **JSON envelope:** Success: `{"data": ...}`, Error: `{"error": "..."}`
- **Pagination:** Cursor-based with base64-encoded JSON cursors
- **Migrations:** SQL files in `cmd/migrate/migrations/`, managed with `golang-migrate`

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
- `internal/ratelimiter/` — fixed-window rate limiter
- `internal/logger/` — Zap logger (dev/prod modes based on `ENV`)

### Frontend (React 19 + TypeScript + Vite)

- **UI:** Tailwind CSS v4 + shadcn/ui (New York style, Radix-based, Lucide icons)
- **Routing:** React Router v7, guards in `shared/auth/guards/`
- **State:** Zustand — global stores in `shared/stores/`, page-local stores co-located in page directories
- **Forms:** React Hook Form + Zod validation
- **Auth client:** `supertokens-auth-react`

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

- **Go:** gofmt check, `go mod verify`, build, `go vet`, `staticcheck`, `go test -race ./...`
- **Frontend:** `npm run format:check`, `npm run lint`, `npm run build`, `npm audit --audit-level=high`

## Git Conventions

- **Commit messages:** Use [Conventional Commits] format (e.g., `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)
- Keep commit messages short (subject line under 72 characters)
- **Never** include `Co-Authored-By` lines in commit messages

## API Routes

**Auth:** `GET /v1/auth/check-email`, `GET /v1/auth/me`
**Hacker:** `GET|PATCH /v1/applications/me`, `POST /v1/applications/me/submit`
**Admin:** `GET /v1/admin/applications`, `GET /v1/admin/applications/stats`, `GET /v1/admin/applications/{id}`, `GET /v1/admin/applications/{id}/notes`, `GET /v1/admin/reviews/pending`, `GET /v1/admin/reviews/completed`, `GET /v1/admin/reviews/next`, `PUT /v1/admin/reviews/{id}`, `GET /v1/admin/scans/types`, `POST /v1/admin/scans`, `GET /v1/admin/scans/user/{userID}`, `GET /v1/admin/scans/stats`
**Super Admin:** `GET|PUT /v1/superadmin/settings/saquestions`, `GET|POST /v1/superadmin/settings/reviews-per-app`, `GET|POST /v1/superadmin/settings/review-assignment-toggle`, `POST /v1/superadmin/applications/assign`, `PATCH /v1/superadmin/applications/{id}/status`, `GET /v1/superadmin/applications/emails`, `PUT /v1/superadmin/settings/scan-types`, `POST /v1/superadmin/emails/qr`
**Infra (Basic Auth):** `GET /v1/health`, `GET /v1/debug/vars`, `GET /v1/swagger/*`
