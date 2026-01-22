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

## Development Notes

- Vite proxies `/auth/*` and `/v1/*` to backend (port 8080) in dev mode
- Frontend auth routes (`/auth/callback`, `/auth/verify`, `/auth/callback/google`) bypass proxy
- Swagger docs at `/v1/swagger/*` (requires BasicAuth)
- Metrics at `/v1/debug/vars` (requires BasicAuth)
- Backend runs on port 8080, frontend on port 3000
