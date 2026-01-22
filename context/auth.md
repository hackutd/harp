# Auth Flow Context

## Stack
- **SuperTokens** passwordless (magic links)
- **Backend:** Go + chi router
- **Frontend:** React + supertokens-auth-react
- **Database:** PostgreSQL (users table with roles)

## Key Files

| Location | Purpose |
|----------|---------|
| `cmd/api/api.go` | Route definitions, SuperTokens init |
| `cmd/api/middlewares.go` | Session verification, user creation, role checks |
| `client/web/src/lib/supertokens.ts` | Frontend SuperTokens config |
| `client/web/src/pages/public/Login.tsx` | Email input, calls `createCode()` |
| `client/web/src/pages/public/AuthVerify.tsx` | Magic link landing, calls `consumeCode()` |
| `client/web/src/pages/public/AuthCallback.tsx` | Post-auth redirect logic |
| `client/web/src/store.tsx` | Zustand store with `fetchUser()` |
| `client/web/src/components/guards/` | Route guards (RequireAuth, RequireAdmin, RequireSuperAdmin) |

## Auth Flow

1. **Login:** User enters email → `createCode()` → `POST /auth/signinup/code` → email sent
2. **Verify:** User clicks link → `/auth/verify` → `consumeCode()` → `POST /auth/signinup/code/consume` → session cookies set
3. **Callback:** `/auth/callback` → `GET /auth/me` → user created if new → redirect by role

## Roles

| Role | Level | Access |
|------|-------|--------|
| `hacker` | 1 | `/app/*` |
| `admin` | 2 | `/app/*`, `/admin/*` |
| `super_admin` | 3 | All routes |

Hierarchy: `super_admin` >= `admin` >= `hacker`. Middleware uses `RequireRoleMiddleware(minRole)`.

## Middleware Chain (protected routes)

```
Request → SessionVerificationMiddleware → EnsureUserMiddleware → RequireRoleMiddleware → Handler
```

- **SessionVerificationMiddleware:** Validates JWT from cookies
- **EnsureUserMiddleware:** Creates user in DB if new, syncs role from DB to JWT claims
- **RequireRoleMiddleware:** Checks user role meets minimum required level

## Endpoints

| Endpoint | Handler |
|----------|---------|
| `POST /auth/signinup/code` | SuperTokens (request magic link) |
| `POST /auth/signinup/code/consume` | SuperTokens (verify link) |
| `POST /auth/signout` | SuperTokens (logout) |
| `GET /auth/me` | Custom (returns user profile) |

## Session Cookies

SuperTokens sets `sAccessToken` (JWT with role claim), `sRefreshToken`, `sIdRefreshToken`. All HttpOnly.

## Vite Proxy

`/auth/*` and `/v1/*` proxy to backend. Exception: `/auth/verify` and `/auth/callback` are frontend routes (bypass in vite.config.ts).

## Role Sync

When DB role changes, `EnsureUserMiddleware` updates the JWT claims on next request via `MergeIntoAccessTokenPayload()`.
