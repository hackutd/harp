# Public API Pattern (X-API-Key Auth)

For endpoints exposed to non-portal clients (e.g., the public hackathon website pulling sponsor data). Auth is by static API key in `X-API-Key` header — not SuperTokens session.

## When to Use

External, headless clients need read-only data the portal already has. Examples: public schedule, public sponsor list. Don't use this for write endpoints — anything mutating state belongs behind real auth.

Working example: **Public schedule, public sponsors** (`cmd/api/public.go`).

## The Auth Layer

`APIKeyMiddleware` lives in `cmd/api/middlewares.go`:

```go
func (app *application) APIKeyMiddleware(next http.Handler) http.Handler {
    expectedKey := []byte(app.config.auth.publicAPIKey)
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        key := r.Header.Get("X-API-Key")
        if key == "" || subtle.ConstantTimeCompare([]byte(key), expectedKey) != 1 {
            app.unauthorizedErrorResponse(w, r, fmt.Errorf("invalid or missing API key"))
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

Constant-time compare via `crypto/subtle` — prevents timing attacks.

## Routes

Public endpoints sit on `/v1/public/*`, separate from `/auth/*` (which SuperTokens owns) and the role-gated `/admin/*` / `/superadmin/*` trees.

```go
r.Route("/v1", func(r chi.Router) {
    r.Route("/public", func(r chi.Router) {
        r.Use(app.APIKeyMiddleware)
        r.Get("/schedule", app.getPublicScheduleHandler)
        r.Get("/sponsors", app.getPublicSponsorsHandler)
    })
    // ... rest of routes ...
})
```

CORS is configured separately in `mount()` — `publicCORSOrigin` is appended to allowed origins so the public website can hit these endpoints.

## Handlers

Often the public endpoint returns the same data as an internal one. Just delegate:

```go
//  @Summary      Get schedule (Public)
//  @Description  Returns the full event schedule, ordered by start time ascending
//  @Tags         public
//  @Produce      json
//  @Param        X-API-Key  header  string  true  "API Key"
//  @Success      200        {object}  ScheduleListResponse
//  @Failure      401        {object}  object{error=string}
//  @Failure      500        {object}  object{error=string}
//  @Router       /public/schedule [get]
func (app *application) getPublicScheduleHandler(w http.ResponseWriter, r *http.Request) {
    app.listScheduleHandler(w, r)
}
```

Important Swagger differences from authenticated endpoints:
- **No `@Security`** — public endpoints aren't cookie-authenticated. Document the API key as a `header` param instead.
- **`@Tags public`** — the spec orders these as one of the first tag groups.

If the public version has different shape from the admin version (e.g., redacted fields), don't delegate — write a separate handler that calls a tailored store method.

## Tests

Public endpoints are easiest to test through the full router (`app.mount()`) so the API key middleware runs:

```go
func TestGetPublicSchedule(t *testing.T) {
    t.Run("returns 401 without API key", func(t *testing.T) {
        app := newTestApplication(t)
        mux := app.mount()

        req, _ := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
        rr := executeRequest(req, mux)
        checkResponseCode(t, http.StatusUnauthorized, rr.Code)
    })

    t.Run("returns 200 with schedule items", func(t *testing.T) {
        app := newTestApplication(t)
        mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
        mux := app.mount()

        mockSchedule.On("List").Return([]store.ScheduleItem{ /* ... */ }, nil).Once()

        req, _ := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
        req.Header.Set("X-API-Key", "test-api-key")    // matches newTestApplication config

        rr := executeRequest(req, mux)
        checkResponseCode(t, http.StatusOK, rr.Code)
        // ... decode body and assert ...
    })
}
```

`newTestApplication(t)` sets `auth.publicAPIKey: "test-api-key"`. Tests must use that exact value.

Coverage checklist:

| Case | Expected |
|------|----------|
| No header | 401 |
| Wrong key | 401 |
| Correct key | 200 with body |
| Empty result | 200 with empty array |
| Store error | 500 |

See `cmd/api/public_test.go`.

## What NOT to Do

- Don't expose write endpoints through the public API key. Mutations belong behind authenticated routes.
- Don't compare keys with `==` on raw strings — use `subtle.ConstantTimeCompare`.
- Don't add `@Security CookieAuth` to public Swagger comments. Document the key as a header param instead.
- Don't reuse the SuperTokens cookie origin for public endpoints — `publicCORSOrigin` is its own config.
