---
name: backend
description: "HARP Go backend development guide. Generates handlers, store implementations, migrations, mock stores, routes, and tests following the established conventions. Use this skill whenever implementing new backend features, adding API endpoints, creating database tables, writing Go handler tests, or modifying the store layer. Also use when the user asks to add a new resource/entity, CRUD endpoints, or admin routes to the Go backend."
---

# HARP Go Backend Development Guide

This skill orchestrates pattern selection for Go backend work. The codebase has distinct endpoint patterns (CRUD, self-resource, paginated list, workflow queue, file storage, public API, bulk operations, status update, settings) — each with its own conventions documented in a reference file. Before writing code, identify the pattern that matches the request and read the matching reference plus `overview.md`.

## Step 1 — Always read `overview.md` first

`references/overview.md` covers universal rules that apply to **every** pattern: file map, JSON envelope, handler flow, error helpers, status codes, store rules, mock conventions, route mounting, migrations, Swagger annotations, logging. **Read it once at the start of any backend task.** The pattern references assume you already know these.

## Step 2 — Identify the pattern(s) and read the reference(s)

Match the user's request to one or more patterns. Read every applicable reference. Most features fit one pattern; some combine two (e.g., a CRUD resource that needs cursor pagination → `crud-resource.md` + `list-pagination.md`).

| User asks for... | Pattern | Reference |
|------------------|---------|-----------|
| "Add a new resource" with admin CRUD (list/create/update/delete), or "add an endpoint for managing X" | CRUD Resource | `references/crud-resource.md` |
| "Users manage their own X" (e.g., draft an application, edit profile) — `/me` style | Self-Resource | `references/self-resource.md` |
| List endpoint with cursor pagination, filters, search, or sort | Paginated List | `references/list-pagination.md` |
| "Admin claims work item, then submits result" — queue / pending / next / submit / completed | Workflow Queue | `references/workflow-queue.md` |
| File upload or download (signed URL for large files; base64 JSON for small) | File Storage | `references/file-storage.md` |
| Endpoint for external clients via API key (no SuperTokens session) | Public API | `references/public-api.md` |
| Batch operation, multi-table reset, transactional bulk insert | Bulk Operation | `references/bulk-operations.md` |
| PATCH a single field (status, role, etc.) with whitelisted enum values | Status Update | `references/status-update.md` |
| Toggle / configurable JSON value read by middleware or UI | Settings | `references/settings-pattern.md` |
| Aggregate counts / stats endpoint | Stats sub-pattern | `references/crud-resource.md` ("Stats Sub-Pattern" section) |
| Anything that needs handler tests | (always) | `references/testing.md` |

### Common combinations

- **Admin list with pagination** (e.g., applications list): `crud-resource.md` + `list-pagination.md`.
- **Self-resource with file upload** (e.g., resume on application): `self-resource.md` + `file-storage.md`.
- **CRUD with feature flag gate** (e.g., schedule editing toggle): `crud-resource.md` + `settings-pattern.md`.
- **Self-resource with state machine and submit** (e.g., draft → submitted): `self-resource.md` (covers the submit verb).
- **Anything with admin authorization**: just role-gate via `RequireRoleMiddleware` — see `overview.md` "Route Mounting".

## Step 3 — Build the feature using the references as templates

Each reference is structured to match the codebase's actual layering: migration → store + interface + mock → handlers → routes → tests. Work top-down so you can run/check each layer as you go:

1. **Migration** — bump number, write up + down (see pattern reference for column conventions).
2. **Store model + methods** — copy the relevant skeleton from the reference, adjust columns/constraints.
3. **Storage interface + wiring** — add the interface to `internal/store/storage.go`'s `Storage` struct, wire in `NewStorage()`.
4. **Mock store** — implement the matching mock methods in `internal/store/mock_store.go`, register in `NewMockStore()`.
5. **Handlers** — payload + response structs colocated; follow the standard handler flow.
6. **Routes** — mount in the appropriate group in `cmd/api/api.go`.
7. **Tests** — use `testing.md` recipes; coverage checklist comes from the pattern reference.
8. **Swagger** — `task gen-docs` regenerates the spec (also runs as a pre-command for `air`).

## Quick Critical Rules

These appear in `overview.md` but are worth keeping front-of-mind. Breaking them creates cleanup work:

- **JSON envelope**: `app.jsonResponse(w, status, ResponseStruct{...})` — always wrap data in a named response struct, never pass raw slices/models.
- **Store timeouts**: every method begins with `ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration); defer cancel()` (double the duration for bulk ops).
- **Error mapping**: `store.ErrNotFound` → `notFoundResponse`, `store.ErrConflict` → `conflictResponse`, anything unexpected → `internalServerError`. Don't add per-handler logging — error helpers already log.
- **Mocks omit ctx**: `m.Called(args...)` receives all params except `ctx`; nil-check `args.Get(0)` before type-asserting.
- **Settings**: only on the `Settings` interface; key strings come from `SettingsKey*` constants; setters use JSON body, never query params; tag is `superadmin/settings`.
- **No ORM**: raw SQL with `$1, $2` placeholders. No external HTTP calls inside store methods.
- **No `Co-Authored-By`** in commits.

## When in Doubt

- Reading existing code in the matching pattern is more reliable than guessing. Each reference points to its canonical example file; open it.
- If the request crosses pattern boundaries (e.g., "add an admin CRUD resource that users can also see their own copy of"), build it as two pattern instances rather than fusing them.
- If you can't decide between `crud-resource.md` and `self-resource.md`, ask: does the URL include `/me`? If yes → self-resource. If no → CRUD.
- For tests, the pattern reference's "Coverage Checklist" tells you which cases matter; `testing.md` tells you how to wire each test up.
