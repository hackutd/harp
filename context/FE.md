# Frontend Context

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (Radix-based)
- React Router v6
- Zustand (state)
- SuperTokens (auth)

## Project Structure

```
client/web/src/
├── main.tsx                 # Entry point, router config, SuperTokens init
├── index.css                # Tailwind imports
├── store.tsx                # Zustand stores (useUserStore, useApplicationsStore)
├── types.d.ts               # Shared TypeScript types
├── enums.ts                 # Shared enums
├── lib/
│   ├── api.ts               # Centralized API client (getRequest, postRequest, etc.)
│   ├── supertokens.ts       # SuperTokens config
│   └── utils.ts             # Utility functions (cn, etc.)
├── hooks/
│   ├── useSessionRole.ts    # Get role from session
│   └── use-mobile.ts        # Mobile detection
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── guards/              # Route guards (RequireAuth, RequireAdmin, RequireSuperAdmin)
└── pages/
    ├── public/              # Login, AuthVerify, AuthCallback
    ├── app/                 # Hacker pages (App, Apply, Status)
    ├── admin/               # Admin pages (Applications, ApplicationDetail, Settings, Scans)
    └── superadmin/          # SuperAdmin pages
```

## Routes (main.tsx)

| Path | Guard | Page |
|------|-------|------|
| `/` | - | Login |
| `/auth/verify` | - | AuthVerify (magic link landing) |
| `/auth/callback` | - | AuthCallback (post-auth redirect) |
| `/app` | RequireAuth | App |
| `/app/apply` | RequireAuth | Apply |
| `/app/status` | RequireAuth | Status |
| `/admin/applications` | RequireAdmin | Applications |
| `/admin/applications/:id` | RequireAdmin | ApplicationDetail |
| `/admin/settings` | RequireAdmin | Settings |
| `/admin/scans` | RequireAdmin | Scans |
| `/superadmin` | RequireSuperAdmin | SuperAdmin |

## API Client (lib/api.ts)

All HTTP goes through centralized functions. Never use `fetch` directly in components.

```ts
import { getRequest, postRequest, putRequest, deleteRequest, errorAlert } from "@/lib/api";

const res = await getRequest<User>("/auth/me", "user");
if (res.status !== 200 || !res.data) {
  errorAlert(res);
  return;
}
```

- All requests include `credentials: "include"` for SuperTokens cookies
- Returns `ApiResponse<T>` with `status`, `data?`, `error?`

## State (store.tsx)

| Store | State | Actions |
|-------|-------|---------|
| `useUserStore` | `user`, `loading` | `fetchUser()`, `setUser()`, `clearUser()`, `syncRoleFromSession()` |
| `useApplicationsStore` | `applications`, `loading` | `fetchApplications()`, `setApplications()` |

## Types (types.d.ts)

```ts
type UserRole = 'hacker' | 'admin' | 'super_admin';
type ApplicationStatus = 'pending' | 'in_review' | 'accepted' | 'rejected' | 'waitlisted';

interface User { id, email, role, createdAt, updatedAt }
interface Application { id, userId, status, firstName, lastName, email, school, ... }
interface ApiResponse<T> { status, data?, error? }
```

## Route Guards (components/guards/)

| Guard | Checks |
|-------|--------|
| `RequireAuth` | Session exists |
| `RequireAdmin` | Session + role is `admin` or `super_admin` |
| `RequireSuperAdmin` | Session + role is `super_admin` |

Wrap page components in guards in main.tsx router config.

## Vite Proxy (vite.config.ts)

```ts
proxy: {
  '/auth': {
    target: 'http://localhost:8080',
    bypass: (req) => {
      // Skip proxy for frontend routes
      if (req.url?.startsWith('/auth/callback') || req.url?.startsWith('/auth/verify')) {
        return req.url;
      }
    },
  },
  '/v1': { target: 'http://localhost:8080' },
}
```

## Conventions

**DO:**
- Use shadcn/ui components from `components/ui/`
- Use `lib/api.ts` for all HTTP
- Use Zustand for shared state
- Keep pages thin, move complex UI to components

**DON'T:**
- Use `fetch` directly in components
- Add new UI libraries
- Duplicate shadcn components
- Store local UI state globally without reason
