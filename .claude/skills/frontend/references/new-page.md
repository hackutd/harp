# Adding a New Page End-to-End

This guide walks through creating a complete new page feature in the HARP frontend. Use the admin "all-applicants" page as the canonical reference implementation.

## Step 1: Create the Page Directory

Choose the right role directory based on who accesses this page:

```
src/pages/hacker/<feature-name>/     # Hacker-facing pages
src/pages/admin/<feature-name>/      # Admin pages (admin + super_admin)
src/pages/superadmin/<feature-name>/ # Super admin only pages
```

Directory names use **kebab-case**. Create this structure:

```
src/pages/<role>/<feature-name>/
├── FeaturePage.tsx       # Page entry component (PascalCase, default export)
├── api.ts               # API endpoint wrappers
├── types.ts             # Feature-specific TypeScript types
├── store.ts             # Zustand store instance
├── components/          # Feature-specific components
└── hooks/               # Feature-specific hooks (optional)
```

Only create files you actually need — a simple page might only need `FeaturePage.tsx` and `api.ts`.

## Step 2: Define Types

Create `types.ts` with the feature's data shapes. Match the backend's JSON field names exactly (snake_case):

```typescript
// types.ts
export interface FeatureItem {
  id: string;
  name: string;
  status: FeatureStatus;
  created_at: string;
  updated_at: string;
}

export type FeatureStatus = "active" | "inactive" | "pending";

// Paginated response (matches backend envelope)
export interface FeatureListResult {
  items: FeatureItem[];
  next_cursor: string | null;
  has_more: boolean;
}

// Query parameters for the list endpoint
export interface FetchParams {
  cursor?: string;
  status?: FeatureStatus | null;
  search?: string;
}
```

If a type is shared across multiple pages (like `Application`, `User`, `ApiResponse`), add it to `src/types.ts` instead.

## Step 3: Create the API Module

Create `api.ts` that wraps the shared HTTP client for this feature's endpoints:

```typescript
// api.ts
import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { FeatureItem, FeatureListResult, FetchParams } from "./types";

export async function fetchFeatureItems(
  params?: FetchParams,
  signal?: AbortSignal,
): Promise<ApiResponse<FeatureListResult>> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set("status", params.status);
  if (params?.cursor) queryParams.set("cursor", params.cursor);
  if (params?.search) queryParams.set("search", params.search);

  const qs = queryParams.toString();
  return getRequest<FeatureListResult>(
    `/admin/feature${qs ? `?${qs}` : ""}`,
    "feature items",
    signal,
  );
}

export async function fetchFeatureById(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<FeatureItem>> {
  return getRequest<FeatureItem>(
    `/admin/feature/${id}`,
    "feature item",
    signal,
  );
}

export async function createFeatureItem(
  body: Partial<FeatureItem>,
): Promise<ApiResponse<FeatureItem>> {
  return postRequest<FeatureItem>("/admin/feature", body, "feature item");
}
```

Key points:
- Always accept `signal?: AbortSignal` on GET requests for cleanup
- Build query strings with `URLSearchParams`
- Return `Promise<ApiResponse<T>>` with the specific response type
- The second arg to `getRequest`/`postRequest` is the error context string for toast messages

## Step 4: Create the Store

For a simple page, create `store.ts` directly:

```typescript
// store.ts
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import { fetchFeatureItems as apiFetch } from "./api";
import type { FeatureItem, FeatureStatus, FetchParams } from "./types";

interface FeatureState {
  items: FeatureItem[];
  loading: boolean;
  currentStatus: FeatureStatus | null;
  fetchItems: (params?: FetchParams, signal?: AbortSignal) => Promise<void>;
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  items: [],
  loading: false,
  currentStatus: null,

  fetchItems: async (params, signal) => {
    set({ loading: true });

    const status = params?.status !== undefined ? params.status : get().currentStatus;

    const res = await apiFetch({ ...params, status }, signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({
        items: res.data.items,
        loading: false,
        currentStatus: status,
      });
    } else {
      errorAlert(res);
      set({ items: [], loading: false });
    }
  },
}));
```

If the store needs to be reusable with different configurations (e.g., same list page used in admin and super admin with different defaults), use the factory pattern instead — put the factory in `createStore.ts` and the configured instance in `store.ts`.

## Step 5: Build the Page Component

Create `FeaturePage.tsx` with a default export:

```typescript
// FeaturePage.tsx
import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { FeatureTable } from "./components/FeatureTable";
import { useFeatureStore } from "./store";

export default function FeaturePage() {
  // Store selectors
  const items = useFeatureStore((s) => s.items);
  const loading = useFeatureStore((s) => s.loading);
  const fetchItems = useFeatureStore((s) => s.fetchItems);
  const currentSearch = useFeatureStore((s) => s.currentSearch);

  // Local UI state
  const [searchInput, setSearchInput] = useState(currentSearch ?? "");
  const isFirstRender = useRef(true);

  // Fetch on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchItems(undefined, controller.signal);
    return () => controller.abort();
  }, [fetchItems]);

  // Debounced search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchItems({ search: searchInput.length >= 2 ? searchInput : "" });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, fetchItems]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feature Name</h1>
        <Input
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <FeatureTable items={items} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Step 6: Create Components

Put feature-specific components in `components/`. Use `React.memo()` for table/list components:

```typescript
// components/FeatureTable.tsx
import { memo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components";

import type { FeatureItem } from "../types";

interface FeatureTableProps {
  items: FeatureItem[];
  loading: boolean;
  onSelect?: (id: string) => void;
}

export const FeatureTable = memo(function FeatureTable({
  items,
  loading,
  onSelect,
}: FeatureTableProps) {
  if (loading) return <LoadingSpinner />;

  if (items.length === 0) {
    return <p className="p-6 text-center text-muted-foreground">No items found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            className="cursor-pointer"
            onClick={() => onSelect?.(item.id)}
          >
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.status}</TableCell>
            <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});
```

## Step 7: Add the Route

In `src/routes.tsx`:

1. Add the lazy import at the top:

```typescript
const FeaturePage = lazy(
  () => import("@/pages/admin/feature-name/FeaturePage"),
);
```

2. Add the route to the appropriate children array:

```typescript
// For admin pages — inside the /admin children array:
{
  path: "feature-name",
  element: (
    <Suspense fallback={<PageLoader />}>
      <FeaturePage />
    </Suspense>
  ),
}

// For super admin pages — wrap with RequireSuperAdmin:
{
  path: "sa/feature-name",
  element: (
    <RequireSuperAdmin>
      <Suspense fallback={<PageLoader />}>
        <FeaturePage />
      </Suspense>
    </RequireSuperAdmin>
  ),
}

// For hacker pages — add as a top-level route with RequireAuth:
{
  path: "/app/feature-name",
  element: (
    <RequireAuth>
      <Suspense fallback={<PageLoader />}>
        <FeaturePage />
      </Suspense>
    </RequireAuth>
  ),
}
```

## Step 8: Add Sidebar Navigation (Admin Pages)

For admin pages, add a link in the sidebar. The sidebar is defined in `src/pages/admin/_shared/`. Add the new page's path and icon to the nav items array.

## Checklist

Before considering the page complete:

- [ ] Types match backend response shape (snake_case fields)
- [ ] API module uses shared client, accepts `AbortSignal`
- [ ] Store checks `signal?.aborted` before calling `set()`
- [ ] Page component cleans up with `AbortController` in `useEffect`
- [ ] Route is lazy-loaded with `<Suspense fallback={<PageLoader />}>`
- [ ] Route has the correct auth guard (`RequireAuth`, `RequireAdmin`, or `RequireSuperAdmin`)
- [ ] Imports follow boundary rules (no cross-page imports, no deep `@/shared/auth/*` imports)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes (TypeScript + Vite)
