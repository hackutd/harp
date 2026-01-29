# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HARP (Hacker Applications & Review Platform) - A hackathon management system with Go backend and React frontend, using SuperTokens authentication (passwordless magic links + Google OAuth).

## Common Commands

### Backend (Go)

```bash
go build -o api ./cmd/api      # Build API binary
go run ./cmd/api               # Run API server
air                            # Run with live reload (uses .air.toml)
```

### Frontend (React/Vite)

```bash
cd client/web
npm run dev                    # Start dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint
```

### Database & Migrations

```bash
docker-compose up              # Start PostgreSQL (port 5432)
make migrate-up                # Run pending migrations
make migrate-down              # Rollback last migration
make migrate-create NAME       # Create new migration (e.g., make migrate-create create_users_table)
make migrate-force-0           # Force migration version to 0 (use when migration is dirty)
make migrate-force-1           # Force migration version to 1
make seed                      # Run database seed script
```

### Documentation

```bash
make gen-docs                  # Generate Swagger API docs (swag init)
```

## Architecture

### Backend Structure (cmd/api/)

- `main.go` - Server initialization, dependency injection, SuperTokens init
- `api.go` - Route definitions using chi router, middleware stack, config structs
- `auth.go` - Authentication handlers (`/auth/check-email`, `/auth/me`)
- `middlewares.go` - BasicAuth, AuthRequired, RequireRole middleware
- `errors.go`, `json.go` - HTTP response utilities

### Internal Packages (internal/)

- `auth/` - SuperTokens passwordless + Google OAuth configuration
- `store/` - Data access layer (PostgreSQL) with interface-based design
- `mailer/` - SendGrid email integration
- `db/` - PostgreSQL connection management
- `ratelimiter/` - Fixed-window rate limiter (20 req/5s per IP)
- `env/` - Environment variable utilities (`GetString`, `GetRequiredString`, `GetInt`, `GetBool`)

### Frontend Structure (client/web/src/)

- `main.tsx` - Router setup with react-router-dom v7
- `pages/` - Route components organized by role: `public/`, `app/` (hacker), `admin/`, `superadmin/`
- `components/guards/` - Route protection: `RequireAuth`, `RequireAdmin`, `RequireSuperAdmin`
- `components/ui/` - shadcn/ui components
- `lib/supertokens.ts` - SuperTokens client initialization
- `store.tsx` - Zustand global state

### Request Flow

```
HTTP → chi Router → Middleware (RequestID, RealIP, Logger, Recoverer, CORS, SuperTokens) → RateLimiter → Handler → internal packages → PostgreSQL
```

## Key Dependencies

**Backend:** chi (router), supertokens-golang, sendgrid-go, lib/pq (PostgreSQL), zap (logging), validator/v10, swag (docs)

**Frontend:** React 19, Vite 7, TypeScript, react-router-dom v7, supertokens-auth-react, Zustand, shadcn/ui (Radix), Tailwind CSS v4, react-hook-form, Zod

## Database

PostgreSQL 16.3 with extensions: `citext` (case-insensitive emails), `pgcrypto` (UUID generation)

User roles enum: `hacker`, `admin`, `super_admin`

Auth methods enum: `passwordless`, `google`

## Environment Variables

Required in `.env`:
- `DB_ADDR` - PostgreSQL connection string
- `SENDGRID_API_KEY` - SendGrid API key for emails
- `AUTH_BASIC_USER`, `AUTH_BASIC_PASS` - BasicAuth for admin endpoints
- `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY` - SuperTokens core connection

Optional:
- `ADDR` (default: `:8080`) - Server listen address
- `FRONTEND_URL` (default: `http://localhost:3000`) - CORS origin
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials

## Coding Patterns

### Store Layer (internal/store/)

**Models:** Define structs with `json` and `validate` tags. Use pointer types (`*string`, `*int16`, `*time.Time`) for nullable DB columns. Use `json.RawMessage` for JSONB columns, `[]string` with `pq.Array()` for PostgreSQL arrays.

**Enums:** Define as `type MyEnum string` with constants:

```go
type ApplicationStatus string
const (
    StatusDraft     ApplicationStatus = "draft"
    StatusSubmitted ApplicationStatus = "submitted"
)
```

**Store structs:** Each domain gets a struct holding `*sql.DB` and an interface in the `Storage` struct:

```go
type MyStore struct { db *sql.DB }
```

Registered in `NewStorage()` in `storage.go`.

**Query methods:** Always use 5-second context timeout, map `sql.ErrNoRows` to `ErrNotFound`:

```go
func (s *MyStore) GetByID(ctx context.Context, id string) (*MyModel, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()
    // QueryRowContext → Scan
    // errors.Is(err, sql.ErrNoRows) → return nil, ErrNotFound
}
```

**Updates:** Use `RETURNING` to scan updated values back into the struct. Upserts use `ON CONFLICT ... DO UPDATE`.

### API Handlers (cmd/api/)

**Handler pattern** (5 steps):

1. Parse JSON body: `readJSON(w, r, &payload)` — enforces 1MB limit, disallows unknown fields
2. Validate: `Validate.Struct(payload)` — uses `validator/v10` tags
3. Business logic / additional validation
4. Call store method with `r.Context()`
5. Return response: `app.jsonResponse(w, http.StatusOK, responseStruct)`

**Request/Response types:** Define payload structs with `json` + `validate` tags, and response wrapper structs:

```go
type CreateThingPayload struct {
    Name string `json:"name" validate:"required,min=1,max=100"`
}
type ThingResponse struct {
    Thing store.Thing `json:"thing"`
}
```

**Error responses:** Use helpers — `badRequestResponse` (400), `notFoundResponse` (404), `conflictResponse` (409), `internalServerError` (500), `unauthorizedErrorResponse` (401), `forbiddenResponse` (403).

**URL params:** `chi.URLParam(r, "paramName")` for path parameters like `{applicationID}`.

**Current user:** `getUserFromContext(r.Context())` returns `*store.User` set by `AuthRequiredMiddleware`.

**Swagger annotations:** Add `@Summary`, `@Description`, `@Tags`, `@Accept`/`@Produce`, `@Param`, `@Success`, `@Failure`, `@Security CookieAuth`, `@Router` comments above each handler.

### Route Registration (cmd/api/api.go)

- Hacker routes: `/v1/applications/*` — requires `AuthRequiredMiddleware`
- Admin routes: `/v1/admin/*` — requires `RequireRoleMiddleware(store.RoleAdmin)`
- Super admin routes: `/v1/superadmin/*` — requires `RequireRoleMiddleware(store.RoleSuperAdmin)`
- Use `r.Group()` to scope middleware, `r.Route()` to scope path prefixes

### Validation Tags (validator/v10)

Common tags: `required`, `omitempty`, `min=N`, `max=N`, `email`, `url`, `e164`, `oneof=val1 val2`, `dive` (validate slice elements)

## Development Notes

- Vite proxies `/auth/*` and `/v1/*` to backend (port 8080) in dev mode
- Frontend auth routes (`/auth/callback`, `/auth/verify`, `/auth/callback/google`) bypass proxy
- Swagger docs at `/v1/swagger/*` (requires BasicAuth)
- Metrics at `/v1/debug/vars` (requires BasicAuth)
- Backend runs on port 8080, frontend on port 3000
