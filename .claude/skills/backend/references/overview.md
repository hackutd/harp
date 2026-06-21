# Backend Architecture Overview

Universal conventions and a decision tree for picking the right endpoint pattern. Read this first, then read the pattern reference that matches the feature you're building.

## File Map

| Component | Location | Naming |
|-----------|----------|--------|
| Handlers | `cmd/api/<resource>.go` | One file per resource domain |
| Handler tests | `cmd/api/<resource>_test.go` | Same package (`package main`) |
| Store model + impl | `internal/store/<resource>.go` | One file per resource |
| Store interface | `internal/store/storage.go` | Add to `Storage` struct, wire in `NewStorage()` |
| Mock store | `internal/store/mock_store.go` | Add mock + update `NewMockStore()` |
| Migrations | `cmd/migrate/migrations/` | `000NNN_<verb>_<subject>.{up,down}.sql` |
| Routes | `cmd/api/api.go` | `mount()`, in the matching role group |
| Test utilities | `cmd/api/test_utils_test.go` | Shared helpers (do not duplicate) |

## Endpoint Pattern Decision Tree

Match the user's request to a pattern, then read the corresponding reference.

| User asks for... | Pattern | Reference |
|------------------|---------|-----------|
| "add a new resource" with admin CRUD (list/create/update/delete) | CRUD Resource | `crud-resource.md` |
| "users manage their own X" (e.g., draft/submit, applications) | Self-Resource | `self-resource.md` |
| List endpoint with cursor pagination, filters, sort, or search | Paginated List | `list-pagination.md` |
| Admin claims work item, processes it, submits result (queue) | Workflow Queue | `workflow-queue.md` |
| File upload/download — signed URLs (large files) or base64 JSON (small files) | File Storage | `file-storage.md` |
| Endpoint exposed via API key for external consumers | Public API | `public-api.md` |
| Batch action across many rows, multi-table reset, transactional bulk | Bulk Operation | `bulk-operations.md` |
| PATCH a single field (status, role) with whitelisted values | Status Update | `status-update.md` |
| Toggle/setting (boolean, JSON value) read by middleware or UI | Settings | `settings-pattern.md` |
| Aggregate counts/stats endpoint | Stats sub-pattern | `crud-resource.md` (Stats section) |
| Anything that needs handler tests | (always) | `testing.md` |

For features that combine patterns (common): read each relevant reference. Example: "admin list of applications with cursor pagination" → `crud-resource.md` + `list-pagination.md`.

## Universal Rules (apply to ALL patterns)

These hold regardless of pattern. Don't break them.

### JSON Envelope

`app.jsonResponse(w, status, data)` wraps in `{"data": ...}`. Pass a **named response struct**, never a raw slice or model:

```go
//  Right
app.jsonResponse(w, http.StatusOK, ScheduleListResponse{Schedule: items})
//  Wrong
app.jsonResponse(w, http.StatusOK, items)
```

| Scenario | Response struct | JSON shape |
|----------|----------------|------------|
| Single item | `<Resource>Response` | `{"data": {"sponsor": {...}}}` (or just the resource if no wrapper needed) |
| List | `<Resources>Response` or `<Resource>ListResponse` | `{"data": {"sponsors": [...]}}` |
| Composite | Descriptive struct | `{"data": {"applicants": [...], "count": 12}}` |

JSON field names are snake_case. Response structs and their payloads live in the same handler file.

### Handler Method Pattern

Every handler is a method on `*application` and follows this flow:

1. **URL params**: `chi.URLParam(r, "fooID")` — validate non-empty before use.
2. **Body parse**: `readJSON(w, r, &payload)` — only for POST/PUT/PATCH.
3. **Validate**: `Validate.Struct(payload)` — uses `go-playground/validator/v10`.
4. **User from context** (when needed): `getUserFromContext(r.Context())`.
5. **Call store**.
6. **Map errors**: `errors.Is(err, store.ErrNotFound)` → `notFoundResponse`, `errors.Is(err, store.ErrConflict)` → `conflictResponse`, anything else → `internalServerError`.
7. **Respond**: `app.jsonResponse(w, statusCode, ResponseStruct{...})`.

### Error Helpers

Use these (`cmd/api/errors.go`) — they log with `method`/`path` already, so don't duplicate:

| Helper | Status | Use when... |
|--------|--------|-------------|
| `app.badRequestResponse(w, r, err)` | 400 | Bad input, validation failure |
| `app.unauthorizedErrorResponse(w, r, err)` | 401 | Missing/invalid auth |
| `app.forbiddenResponse(w, r, err)` | 403 | Auth ok, role/feature gate fails |
| `app.notFoundResponse(w, r, err)` | 404 | Resource missing |
| `app.conflictResponse(w, r, err)` | 409 | State conflict, duplicate |
| `app.internalServerError(w, r, err)` | 500 | Unexpected error |
| `writeJSONError(w, status, msg)` | any | Custom code (e.g., 503 for service unavailable) |

### Status Codes

| Operation | Code |
|-----------|------|
| GET (read) | 200 |
| POST (create) | 201 |
| PUT (full update) | 200 |
| PATCH (partial update) | 200 |
| DELETE | 204 (no body — `w.WriteHeader(http.StatusNoContent)`) |

### Store Method Pattern

Every store method:

1. `ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration); defer cancel()` — `QueryTimeoutDuration` is 5s; double it for bulk operations.
2. Raw SQL with `$1, $2` placeholders (no ORM).
3. `sql.ErrNoRows` → `ErrNotFound`.
4. `RowsAffected() == 0` on UPDATE/DELETE → `ErrNotFound`.
5. INSERT/UPDATE uses `RETURNING` clause to populate generated fields (`id`, `created_at`, `updated_at`) on the input pointer.
6. Unique-constraint violations → `ErrConflict` (check via `pgconn.PgError` code `23505`, or `strings.Contains(err.Error(), "<constraint_name>")`).

### Mock Store Pattern

For each store method, add a mock method:

```go
func (m *MockFooStore) GetByID(ctx context.Context, id string) (*Foo, error) {
    args := m.Called(id)                          // pass all params EXCEPT ctx
    if args.Get(0) == nil {                       // nil-check before type assertion
        return nil, args.Error(1)
    }
    return args.Get(0).(*Foo), args.Error(1)
}
```

For methods returning only error: just `return args.Error(0)`. For booleans: `args.Bool(0)`. For ints: `args.Int(0)`. Wire up in `NewMockStore()`.

### Route Mounting (api.go)

Routes nest by auth/role. Add inside the matching group:

```go
// /v1/public/*           — APIKeyMiddleware (no SuperTokens session)
// /v1/auth/check-email   — unauthenticated
// /v1/auth/me            — AuthRequiredMiddleware (any logged-in user)
// /v1/health             — BasicAuthMiddleware
// inside r.Use(app.AuthRequiredMiddleware):
//   /v1/applications/me  — hacker self-resource
//   inside r.Use(app.RequireRoleMiddleware(store.RoleAdmin)):
//     /v1/admin/*        — admin or super_admin
//     inside r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin)):
//       /v1/superadmin/* — super_admin only
```

Settings-gated middleware (`ApplicationsEnabledMiddleware`, `AdminScheduleEditPermissionMiddleware`) wraps subgroups via `r.Group` + `r.Use`.

### Migration Naming

Sequential 6-digit prefix: check the highest in `cmd/migrate/migrations/` and increment. Verbs: `create` (foundational), `add` (new feature/table/column/trigger), `alter` (modifying existing), `seed` (initial data). One concern per migration — table + its trigger + indexes go together; enum types separate.

Tables with `updated_at` reuse the trigger from migration 000002:

```sql
CREATE TRIGGER trg_<table>_updated_at
    BEFORE UPDATE ON <table> FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
```

Conventions: UUID PKs (`gen_random_uuid()`), `TIMESTAMPTZ`, `TEXT[]` (use `store.StringArray`) for arrays, `JSONB` for structured data, columns `NOT NULL DEFAULT ...` whenever sensible.

### Swagger Annotations

Every handler has doc comments:

```go
//  @Summary      Short summary (Role)
//  @Description  Longer description
//  @Tags         <route group>
//  @Accept       json     // POST/PUT/PATCH only
//  @Produce      json
//  @Param        name  in    type     required  "description"
//  @Success      200   {object}  ResponseStructName
//  @Failure      400   {object}  object{error=string}
//  @Security     CookieAuth   // omit for public (api-key) endpoints
//  @Router       /path [method]
```

Tags follow the route group:

| Group | Tag |
|-------|-----|
| `/applications/me`, `/applications/enabled` | `hackers` |
| `/auth/*` | `auth` |
| `/public/*` | `public` |
| `/admin/applications/*` | `admin/applications` |
| `/admin/reviews/*` | `admin/reviews` |
| `/admin/scans/*` | `admin/scans` |
| `/admin/schedule/*` | `admin/schedule` |
| `/admin/sponsors/*` | `admin/sponsors` |
| `/superadmin/applications/*` | `superadmin/applications` |
| `/superadmin/settings/*` | `superadmin/settings` |
| `/superadmin/users/*` | `superadmin/users` |
| `/superadmin/reset-hackathon` | `superadmin` |

After editing handlers, run `task gen-docs` to regenerate Swagger output (this is also a pre-command for `air`).

### Logging

Zap `SugaredLogger` configured for Google Cloud Logging. **Always** use the `w`-suffix structured methods (`Infow`, `Warnw`, `Errorw`). Never `Infof`/`Warnf`/`Errorf`.

Error helpers (`cmd/api/errors.go`) already log with `method`/`path` — do not add explicit handler-level logs for normal request flows. Add explicit logs only for side-effects outside the request flow (e.g., user creation in middleware, GCS deletion warnings).

When you do log: include `"method", r.Method, "path", r.URL.Path` and any context (`"user_id"`, `"email"`, `"error"`).

### Imports & Tooling

- Module path: `github.com/hackutd/portal/...`
- Routing: `github.com/go-chi/chi`
- Validation: `github.com/go-playground/validator/v10`
- Tests: `github.com/stretchr/testify/{mock,assert,require}`
- DB: `database/sql` (stdlib) + `github.com/jackc/pgx/v5/stdlib` driver
- Postgres errors: `github.com/jackc/pgx/v5/pgconn` (for `*pgconn.PgError`)
- Logging: `go.uber.org/zap`

### Things to Avoid

- An ORM. Raw SQL only.
- Calling external HTTP services from store methods.
- Passing raw slices/models to `app.jsonResponse` — wrap in named struct.
- Skipping `context.WithTimeout` in store methods.
- Hardcoding settings keys — define `SettingsKey<Name>` constants.
- Query params for setter handlers — use `readJSON` with a payload struct.
- Putting settings-table queries in resource-specific stores — they belong on `Settings`.
- Reaching for new abstractions when the existing pattern fits.
