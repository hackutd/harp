# Frontend Architecture

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (Radix-based, "new-york" style)
- React Router v7
- Zustand (global state)
- SuperTokens (auth — passwordless magic links + Google OAuth)
- react-hook-form + Zod (forms & validation)
- sonner (toasts), lucide-react (icons)

## Project Structure

```
client/web/src/
├── main.tsx              # Entry point, router config, SuperTokens init
├── index.css             # Tailwind + theme variables (light/dark)
├── store.tsx             # Zustand stores
├── types.d.ts            # Shared TypeScript types
├── lib/
│   ├── api.ts            # Centralized fetch-based API client
│   ├── supertokens.ts    # SuperTokens config
│   ├── utils.ts          # Helpers (cn)
│   └── validations/      # Zod schemas
├── hooks/                # Custom hooks (useSessionRole, use-mobile, etc.)
├── components/
│   ├── ui/               # shadcn/ui primitives (button, dialog, form, table, etc.)
│   ├── guards/           # Route guards (RequireAuth, RequireAdmin, RequireSuperAdmin)
│   └── shared/           # Reusable non-shadcn components
├── features/             # Domain-specific component groups (wizard, sidebar, settings)
├── pages/
│   ├── auth/             # Login, magic link callbacks, OAuth callbacks
│   ├── hacker/           # Hacker-facing pages
│   ├── admin/            # Admin pages (nested by domain: applications/, reviews/, etc.)
│   └── superadmin/       # Super admin pages
├── layouts/              # Page layouts (e.g. AdminLayout with sidebar + header)
└── assets/               # Static images
```

## Routing & Guards

Routes defined in `main.tsx` using `createBrowserRouter`. Three guard levels wrap route groups:

| Guard | Allows | Redirects to |
|-------|--------|--------------|
| `RequireAuth` | Any authenticated user | `/` |
| `RequireAdmin` | `admin` or `super_admin` | `/app` |
| `RequireSuperAdmin` | `super_admin` only | `/app` |

Guards check SuperTokens session + user role from `useUserStore`, show loading state while resolving, then render `<Outlet />` or redirect.

Route prefixes: `/` (public), `/app` (hacker), `/admin`, `/superadmin`.

## API Client (lib/api.ts)

All HTTP goes through centralized functions. Never use `fetch` directly in components.

```ts
import { getRequest, postRequest, patchRequest, deleteRequest, errorAlert } from "@/lib/api"

const res = await getRequest<MyType>("/v1/endpoint", "context");
if (res.status !== 200 || !res.data) {
  errorAlert(res);
  return;
}
// use res.data
```

- Returns `ApiResponse<T>` with `status`, `data?`, `error?`
- Includes `credentials: "include"` for SuperTokens session cookies
- `errorAlert(res, message?)` shows toast via sonner

## State Management (store.tsx)

Zustand stores for cross-component state. Each store follows the pattern:

```ts
export const useMyStore = create<MyState>((set) => ({
  data: null,
  loading: false,
  fetchData: async () => {
    set({ loading: true });
    const res = await getRequest<MyType>("/v1/...");
    set({ data: res.data ?? null, loading: false });
  },
}));
```

Keep stores minimal. Use local component state for UI-only concerns.

## Forms

Use react-hook-form + Zod for all forms:

```ts
const schema = z.object({ name: z.string().min(1) });
type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({ resolver: zodResolver(schema) });
```

- Zod schemas live in `lib/validations/`
- Multi-step forms use per-step schemas + a combined schema
- Transform helpers convert between API shape and form shape

## Styling

- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Theme via CSS custom properties in `index.css` (OKLch color space)
- Light/dark mode (class-based, next-themes)
- Use `cn()` from `lib/utils.ts` to merge Tailwind classes

## Vite Dev Server

Port 3000. Proxies `/auth/*` and `/v1/*` to backend at `localhost:8080`, bypassing proxy for frontend auth routes (`/auth/callback`, `/auth/verify`).

Path alias: `@` → `./src`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (defaults to `window.location.origin`) |
| `VITE_GOOGLE_AUTH_ENABLED` | `"true"` to enable Google OAuth button |

## Conventions

**DO:**
- Use shadcn/ui components from `components/ui/`
- Use `lib/api.ts` for all HTTP requests
- Use Zustand for shared state, local state for UI-only concerns
- Use react-hook-form + Zod for forms
- Keep pages thin — extract complex UI into `features/` or `components/shared/`
- Use `@/` path alias for imports
- Use sonner `toast` for notifications

**DON'T:**
- Use `fetch` directly in components
- Add new UI libraries without discussion
- Duplicate or modify shadcn components in place — extend via wrapper components
- Store local UI state globally
- Skip form validation
