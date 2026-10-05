---
name: frontend
description: "HARP React frontend development guide (React 19 + TypeScript + Vite + Tailwind v4). Generates pages, components, Zustand stores, API modules, form validations, route definitions, and the Vitest unit tests that accompany them, following established conventions. Use this skill whenever building new frontend pages, adding UI components, creating Zustand stores, writing API client code, adding form validation, modifying routes, writing or fixing frontend tests, or working in client/portal/. Also use when the user asks to add a new admin page, hacker-facing feature, or super admin view to the React frontend."
---

# HARP Frontend Development Guide

All frontend code lives under `client/portal/`. For adding a new page end-to-end, read `references/new-page.md`. For writing tests — which every new feature needs — read `references/testing.md`.

## File Locations

| Component                | Location                                           | Naming                            |
| ------------------------ | -------------------------------------------------- | --------------------------------- |
| Page entry               | `src/pages/<role>/<feature>/FeaturePage.tsx`       | PascalCase, default export        |
| Page API / store / types | `src/pages/<role>/<feature>/`                      | `api.ts`, `store.ts`, `types.ts`  |
| Page hooks / components  | `src/pages/<role>/<feature>/hooks/`, `components/` | `use[Name].ts`, PascalCase `.tsx` |
| Global types             | `src/types.ts`                                     | Shared across pages               |
| Shared API client        | `src/shared/lib/api.ts`                            | `getRequest`, `postRequest`, etc. |
| UI components            | `src/components/ui/`                               | shadcn/ui — managed by CLI        |
| Admin shared             | `src/pages/admin/_shared/`                         | Barrel via `index.ts`             |
| Auth guards              | `src/shared/auth/`                                 | Barrel export only                |
| Routes                   | `src/routes.tsx`                                   | `createBrowserRouter`             |
| Unit tests               | Beside the source module                           | `<source>.test.ts(x)`             |
| Test setup / config      | `src/test/setup.ts`, `vitest.config.ts`            | Shared aliases: `vite.aliases.ts` |

## Import Boundaries (ESLint enforced — breaks CI)

| Layer         | Can import from                                  |
| ------------- | ------------------------------------------------ |
| `shared/`     | `shared/` only                                   |
| `components/` | `shared/`, `components/`                         |
| `layouts/`    | `shared/`, `components/`, `pages/admin/_shared/` |
| `pages/`      | anything                                         |

Blocked: `@/lib/*`, `@/hooks/*`, `@/stores/*`, `@/features/*` — use `@/shared/*`. No deep imports into `@/shared/auth/guards/*` — use the `@/shared/auth` barrel.

## API Layer

All HTTP through `shared/lib/api.ts` — never call `fetch()` directly. Returns `ApiResponse<T>` with `{ status, data?, error? }`. Page-level `api.ts` wraps the shared client:

```typescript
import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";
import type { FeatureListResult, FetchParams } from "./types";

export async function fetchItems(
  params?: FetchParams,
  signal?: AbortSignal,
): Promise<ApiResponse<FeatureListResult>> {
  const qp = new URLSearchParams();
  if (params?.status) qp.set("status", params.status);
  const qs = qp.toString();
  return getRequest<FeatureListResult>(
    `/admin/feature${qs ? `?${qs}` : ""}`,
    "feature items",
    signal,
  );
}
```

Errors: `errorAlert(res)` from `@/shared/lib/api` shows a toast. Success: `toast.success("message")` via sonner.

## State Management (Zustand)

Global stores in `shared/stores/` (only `useUserStore`). Page-level stores co-located in page dirs. Use **selectors**: `useStore((s) => s.field)`.

```typescript
// store.ts
import { create } from "zustand";
import { fetchItems as apiFetch } from "./api";

interface FeatureState {
  items: Item[];
  loading: boolean;
  fetchItems: (params?: FetchParams, signal?: AbortSignal) => Promise<void>;
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  items: [],
  loading: false,
  fetchItems: async (params, signal) => {
    set({ loading: true });
    const res = await apiFetch(params, signal);
    if (signal?.aborted) return;
    if (res.status === 200 && res.data) {
      set({ items: res.data.items, loading: false });
    } else {
      set({ items: [], loading: false });
    }
  },
}));
```

For reusable stores, use a factory in `createStore.ts` and a configured instance in `store.ts`.

## Components

- `React.memo()` with named functions for list/table components: `export const Table = memo(function Table({...}) {...})`
- Props: `[Component]Props` suffix
- Classes: `cn()` from `@/shared/lib/utils` for conditional merging
- All UI from `@/components/ui/` (shadcn/ui) — no competing libraries

## Forms (React Hook Form + Zod)

Schemas in page dir (`validations.ts`). Multi-step: `STEP_FIELDS` mapping + `form.trigger(STEP_FIELDS[step])`. Form components use `useFormContext()` + shadcn `FormField`/`FormItem`/`FormControl`/`FormMessage`.

## Data Fetching

Always use `AbortController` cleanup:

```typescript
useEffect(() => {
  const controller = new AbortController();
  fetchItems(undefined, controller.signal);
  return () => controller.abort();
}, [fetchItems]);
```

Debounced search: `useState` + `setTimeout(500ms)` + `useRef` to skip first render.

## Routing

Lazy-load with `React.lazy()` + `<Suspense fallback={<PageLoader />}>`. Guards: `<RequireAuth>` (hacker), `<RequireAdmin>` (admin — applied at `/admin` parent), `<RequireSuperAdmin>` (super admin, path under `sa/`).

## Testing (Vitest)

Every feature ships with tests in the same change. Full recipes and pitfalls: `references/testing.md`.

- `npm test` runs Vitest (jsdom). Tests live beside their source as `<source>.test.ts(x)` under `src/`.
- Import `describe`/`it`/`expect`/`vi` from `"vitest"` — globals are off.
- Timezone is pinned to `America/Chicago` in `vitest.config.ts` — assert exact local-time strings.
- The config resets every mock and stubbed global before each test — set mock behavior inside the test or its `beforeEach`.
- Stores: mock the page `api.ts` (and `sonner`) with `vi.hoisted` + `vi.mock`; reset with `useStore.setState(useStore.getInitialState(), true)`; cover success, failure, abort, and stale-response paths.
- Utils / schemas: `it.each` tables over branches and boundaries.
- Components: Testing Library + `userEvent`, queried by role/label; no snapshots.
- Fixtures: typed factory functions with `Partial<T>` overrides — `npm run build` type-checks tests.

## Naming Conventions

| Category        | Convention              | Example                   |
| --------------- | ----------------------- | ------------------------- |
| Component files | PascalCase              | `ApplicationsTable.tsx`   |
| Hooks           | camelCase, `use` prefix | `useApplicationDetail.ts` |
| Directories     | kebab-case              | `all-applicants/`         |
| Constants       | UPPER_SNAKE_CASE        | `STEP_FIELDS`             |
| Booleans        | `is`/`has`/`can` prefix | `isLoading`, `hasMore`    |
| API functions   | `fetch[Resource]`       | `fetchApplications`       |
| Handlers        | `handle[Action]`        | `handleStatusFilter`      |
| Stores          | `use[Feature]Store`     | `useApplicationsStore`    |

## Types

- Global in `src/types.ts`, page-level in `types.ts` within page dir
- Keep backend snake_case field names as-is
- Union types for enums: `type Status = "draft" | "submitted"`
- Store interfaces: `[Feature]State` suffix
- Import types with `import type`

## Styling

Tailwind v4 with semantic tokens (`bg-primary`, `text-muted-foreground`) — no raw color values. `cn()` for conditional classes. Mobile-first responsive (`md:`/`lg:` breakpoints).

## What NOT to Do

- Don't call `fetch()` directly — use `@/shared/lib/api`
- Don't add competing UI libraries — shadcn/ui only
- Don't import across page boundaries (use `_shared/` for shared admin components)
- Don't deep-import `@/shared/auth/guards/*` — use barrel
- Don't use `@/lib/*`, `@/hooks/*`, `@/stores/*` — use `@/shared/*`
- Don't convert backend snake_case to camelCase
- Don't skip `AbortController` cleanup in `useEffect`
- Don't skip `<Suspense>` on lazy-loaded routes
- Don't ship a feature without tests, or assert a known-wrong value to make one pass
- Don't stub `fetch` outside `shared/lib/api.test.ts` — mock the page `api.ts` instead
- Don't add `Co-Authored-By` to commits
