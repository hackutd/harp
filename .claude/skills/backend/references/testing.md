# Testing Patterns

Shared utilities and recipes for handler tests in `cmd/api/`. All tests live in the same package as handlers (`package main`), use testify (`mock`, `assert`, `require`), and the mock store from `internal/store/mock_store.go`.

Read this alongside the pattern reference for the endpoint you're testing — each pattern reference has a coverage checklist tailored to its shape.

## Test Utilities

All in `cmd/api/test_utils_test.go`. Use these instead of duplicating setup.

| Helper | What it does |
|--------|-------------|
| `newTestApplication(t)` | Build `*application` with mock store, no-op zap logger, mock GCS, mock mailer, real fixed-window rate limiter (20/5s), basic auth `testuser:testpass`, public API key `test-api-key`. |
| `executeRequest(req, mux)` | Run req through handler/mux, return `*httptest.ResponseRecorder`. |
| `checkResponseCode(t, expected, actual)` | Assert status code with descriptive failure. |
| `addBasicAuth(req)` | Set `Authorization: Basic <testuser:testpass>` header. |
| `setUserContext(req, user)` | Inject `*store.User` into request context (bypasses real auth middleware). |
| `newTestUser()` | `RoleHacker`, ID `user-1`. |
| `newAdminUser()` | `RoleAdmin`, ID `admin-1`. |
| `newSuperAdminUser()` | `RoleSuperAdmin`, ID `superadmin-1`. |

SuperTokens is initialized once via `initTestSuperTokens(t)` so `app.mount()` doesn't panic — handled inside `newTestApplication`.

## Three Ways to Wire a Handler

### 1) Direct handler — no URL params, no middleware

The simplest setup. Wrap with `http.HandlerFunc` so the signature matches `http.Handler`:

```go
rr := executeRequest(req, http.HandlerFunc(app.listScheduleHandler))
```

### 2) Mini chi router — URL params

When the handler reads `chi.URLParam`, build a tiny router so chi populates the context:

```go
func scheduleRouter(app *application) chi.Router {
    r := chi.NewRouter()
    r.Put("/{scheduleID}", app.updateScheduleHandler)
    r.Delete("/{scheduleID}", app.deleteScheduleHandler)
    return r
}

// In test:
r := scheduleRouter(app)
req, _ := http.NewRequest(http.MethodDelete, "/item-1", nil)
rr := executeRequest(req, r)
```

For a one-off, inject the route context directly without a router:

```go
rctx := chi.NewRouteContext()
rctx.URLParams.Add("applicationID", "app-1")
req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
```

A small helper in the test file is fine when reused:

```go
withSponsorRouteParam := func(req *http.Request, sponsorID string) *http.Request {
    rctx := chi.NewRouteContext()
    rctx.URLParams.Add("sponsorID", sponsorID)
    return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}
```

### 3) Full mux — middleware, integration

When you need the actual middleware chain (CORS, auth, rate-limiting, role gates):

```go
mux := app.mount()
req, _ := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
req.Header.Set("X-API-Key", "test-api-key")
rr := executeRequest(req, mux)
```

Use this for: public-API auth tests, role-gate enforcement, settings-gated middleware tests, end-to-end "the route is mounted" smoke tests.

For settings-gated middleware tests over a slimmer subset of routes, build a minimal router:

```go
func protectedScheduleMutationRouter(app *application) chi.Router {
    r := chi.NewRouter()
    r.With(app.AdminScheduleEditPermissionMiddleware).Post("/", app.createScheduleHandler)
    r.With(app.AdminScheduleEditPermissionMiddleware).Put("/{scheduleID}", app.updateScheduleHandler)
    r.With(app.AdminScheduleEditPermissionMiddleware).Delete("/{scheduleID}", app.deleteScheduleHandler)
    return r
}
```

## Working with the Mock Store

Each store interface has a `Mock<Name>Store` (testify/mock). Assert on it through a typed cast:

```go
app := newTestApplication(t)
mockApps := app.store.Application.(*store.MockApplicationStore)
mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
```

`m.Called(args...)` receives all params **except `ctx`** — match those exactly. Use `mock.Anything` (only when the value is non-deterministic), `mock.AnythingOfType("*store.Application")` (typed wildcard), or `mock.MatchedBy(func(x T) bool { ... })` (predicate match):

```go
mockSchedule.On("Create", mock.AnythingOfType("*store.ScheduleItem")).Return(nil).Once()

mockGCS.On("GenerateUploadURL", mock.Anything, mock.MatchedBy(func(p string) bool {
    return strings.HasPrefix(p, "resumes/"+user.ID+"/") && strings.HasSuffix(p, ".pdf")
})).Return("https://upload.example.com", nil).Once()
```

Use `.Once()` on every expectation, then `mockApps.AssertExpectations(t)` at the end of the subtest. This catches missing or extra calls.

To inspect/mutate args at call time (e.g., to populate generated fields like ID):

```go
mockSponsors.On("Create", mock.AnythingOfType("*store.Sponsor")).Run(func(args mock.Arguments) {
    sponsor := args.Get(0).(*store.Sponsor)
    sponsor.ID = "new-sponsor"
}).Return(nil).Once()
```

## Decoding Responses

The JSON envelope is `{"data": ...}`. Decode into a wrapper struct in the test:

```go
var body struct {
    Data ScheduleListResponse `json:"data"`
}
require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
assert.Len(t, body.Data.Schedule, 2)
```

For error responses, decode into:

```go
var body struct{ Error string `json:"error"` }
require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
assert.Contains(t, body.Error, "first_name is required")
```

## Mock GCS / Mailer

`app.gcsClient` is `*gcs.MockClient`, `app.mailer` is `*mailer.MockClient`. Same testify/mock pattern:

```go
mockGCS := app.gcsClient.(*gcs.MockClient)
mockGCS.On("DeleteObject", mock.Anything, resumePath).Return(nil).Once()
```

To test the "GCS not configured" branch, set `app.gcsClient = nil` for the duration of the subtest and restore it afterward:

```go
app.gcsClient = nil
// ... run subtest ...
app.gcsClient = mockGCS
```

## Testify Choices

| Need | Use |
|------|-----|
| Assert and continue | `assert.Equal`, `assert.Len`, `assert.True`, `assert.Contains` |
| Assert and stop on failure | `require.NoError`, `require.NotNil` |
| Mock expectations | `mock.On(...).Return(...).Once()` then `mock.AssertExpectations(t)` |

`require` aborts the test on failure (use it for setup/decoding where downstream assertions would panic otherwise). `assert` continues (use it for verifying the actual behavior you care about, where you want to see all failures).

## Subtests

Use `t.Run("description", func(t *testing.T) { ... })` for each scenario. Phrase the description as the expected outcome:

```go
func TestUpdateSchedule(t *testing.T) {
    t.Run("returns 200 on success",       func(t *testing.T) { /* ... */ })
    t.Run("returns 404 when not found",   func(t *testing.T) { /* ... */ })
}
```

The `app := newTestApplication(t)` and mock setup typically live inside each subtest so state doesn't leak.

## Recipes

### Test a settings-gated middleware

```go
func TestApplicationsEnabledMiddleware(t *testing.T) {
    app := newTestApplication(t)
    ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    })

    t.Run("403 when applications are disabled", func(t *testing.T) {
        app.store.Settings.(*store.MockSettingsStore).
            On("GetApplicationsEnabled", mock.Anything).Return(false, nil).Once()

        handler := app.ApplicationsEnabledMiddleware(ok)
        req, _ := http.NewRequest(http.MethodGet, "/", nil)
        req = setUserContext(req, newTestUser())

        rr := executeRequest(req, handler)
        checkResponseCode(t, http.StatusForbidden, rr.Code)
    })

    t.Run("super admin bypasses gate", func(t *testing.T) {
        handler := app.ApplicationsEnabledMiddleware(ok)
        req, _ := http.NewRequest(http.MethodGet, "/", nil)
        req = setUserContext(req, newSuperAdminUser())

        rr := executeRequest(req, handler)
        checkResponseCode(t, http.StatusOK, rr.Code)
        // No mock setup needed — super admin path doesn't read the setting
    })
}
```

### Test a public (API key) endpoint via the full mux

```go
mux := app.mount()
req, _ := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
req.Header.Set("X-API-Key", "test-api-key")
rr := executeRequest(req, mux)
```

### Inject user + URL param + body

```go
body := strings.NewReader(`{"vote":"accept"}`)
req, _ := http.NewRequest(http.MethodPut, "/", body)
req.Header.Set("Content-Type", "application/json")
req = setUserContext(req, newAdminUser())

rctx := chi.NewRouteContext()
rctx.URLParams.Add("reviewID", "rev-1")
req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

rr := executeRequest(req, http.HandlerFunc(app.submitVote))
```

### Test a paginated list handler

Construct the exact filters/cursor/direction/limit expected by the store:

```go
status := store.StatusSubmitted
result := &store.ApplicationListResult{Applications: []store.ApplicationListItem{}, HasMore: false}

mockApps.On("List",
    store.ApplicationListFilters{Status: &status, SortBy: store.SortByRejectVotes},
    (*store.ApplicationCursor)(nil),
    store.DirectionForward,
    50,
).Return(result, nil).Once()

req, _ := http.NewRequest(http.MethodGet, "/?status=submitted&sort_by=reject_votes", nil)
req = setUserContext(req, newAdminUser())
rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
checkResponseCode(t, http.StatusOK, rr.Code)
```

For the validation cases, no store call is expected — leave the mock empty and assert only the status code:

```go
t.Run("400 for invalid status", func(t *testing.T) {
    req, _ := http.NewRequest(http.MethodGet, "/?status=invalid", nil)
    req = setUserContext(req, newAdminUser())
    rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
    checkResponseCode(t, http.StatusBadRequest, rr.Code)
})
```

## What NOT to Do

- Don't write a test that creates its own `*application` from scratch — use `newTestApplication(t)`. It already wires SuperTokens, mocks, logger, rate-limiter.
- Don't test through the real DB. Mock the store.
- Don't forget `mock.AssertExpectations(t)` — without it, missing calls don't fail the test.
- Don't reuse a single `app` across subtests when subtest A sets up a mock that subtest B doesn't expect — pull `app := newTestApplication(t)` inside the subtest.
- Don't mock `ctx` in `m.Called` — the mock pattern omits it.
