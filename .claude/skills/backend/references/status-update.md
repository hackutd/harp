# Status / Field Update Pattern

For PATCH endpoints that change a single whitelisted field on a resource — typically a status, role, or other enum-bounded value. Thin handler, thin store method, strict `oneof=` validation.

## When to Use

The user is asking for "approve / reject / waitlist", "change role", "promote to admin", "set status to X". The endpoint touches one field, the value is from a fixed set, and only privileged users can call it.

Don't use this for general-purpose updates — those belong in `crud-resource.md` or `self-resource.md`.

Working examples:
- **Application status** (`PATCH /superadmin/applications/{id}/status`).
- **User role** (`PATCH /superadmin/users/{userID}/role`).
- **AI percent on a review** (`PUT /admin/applications/{id}/ai-percent`) — same shape but with a numeric `min/max` validation.

## Payload + Response Shape

Single-field payload + response wrapping the updated entity:

```go
type SetStatusPayload struct {
    Status store.ApplicationStatus `json:"status" validate:"required,oneof=accepted rejected waitlisted"`
}

type ApplicationResponse struct {
    Application *store.Application `json:"application"`
}
```

`oneof=...` is the critical validation — anything outside the allowed values returns 400.

For role updates use `oneof=hacker admin super_admin`. For numeric scores use `min=0,max=100`.

## Store

Returns the **updated entity** so the client doesn't need a follow-up GET:

```go
func (s *ApplicationsStore) SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    query := `
        UPDATE applications
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING ` + applicationSelectCols    // share the column list with GetByID/etc.

    var app Application
    if err := scanApplication(s.db.QueryRowContext(ctx, query, id, status), &app); err != nil {
        if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
        return nil, err
    }
    return &app, nil
}
```

Add to the interface in `internal/store/storage.go`:

```go
Application interface {
    // ...
    SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error)
}
```

Mock:

```go
func (m *MockApplicationStore) SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error) {
    args := m.Called(id, status)
    if args.Get(0) == nil { return nil, args.Error(1) }
    return args.Get(0).(*Application), args.Error(1)
}
```

### Conditional update (when ownership / state matters)

If the change should only succeed under certain conditions, encode them in the SQL `WHERE` clause and treat 0 rows affected (or `sql.ErrNoRows` on `RETURNING`) as `ErrNotFound`:

```go
// SetAIPercent: succeeds only if the admin is assigned and the value isn't already set
query := `
    UPDATE applications
    SET ai_percent = $3
    WHERE id = $1
      AND ai_percent IS NULL
      AND EXISTS (
          SELECT 1 FROM application_reviews
          WHERE application_id = $1 AND admin_id = $2
      )
`
result, err := s.db.ExecContext(ctx, query, applicationID, adminID, percent)
if err != nil { return err }
rows, err := result.RowsAffected()
if err != nil { return err }
if rows == 0 { return ErrNotFound }   // bundle "not found" + "not assigned" + "already set"
return nil
```

The handler can return a generic 404 with a message that covers all three cases. Don't add a separate "AlreadySet" error type unless the UI needs to differentiate.

## Handler

Standard handler flow:

```go
//  @Summary      Set application status (Super Admin)
//  @Tags         superadmin/applications
//  @Accept       json
//  @Produce      json
//  @Param        applicationID  path  string            true  "Application ID"
//  @Param        status         body  SetStatusPayload  true  "New status"
//  @Success      200  {object}  ApplicationResponse
//  @Failure      400  {object}  object{error=string}
//  @Failure      404  {object}  object{error=string}
//  @Security     CookieAuth
//  @Router       /superadmin/applications/{applicationID}/status [patch]
func (app *application) setApplicationStatus(w http.ResponseWriter, r *http.Request) {
    applicationID := chi.URLParam(r, "applicationID")
    if applicationID == "" {
        app.badRequestResponse(w, r, errors.New("application ID is required"))
        return
    }

    var payload SetStatusPayload
    if err := readJSON(w, r, &payload); err != nil { app.badRequestResponse(w, r, err); return }
    if err := Validate.Struct(payload); err != nil  { app.badRequestResponse(w, r, err); return }

    application, err := app.store.Application.SetStatus(r.Context(), applicationID, payload.Status)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("application not found")); return
        }
        app.internalServerError(w, r, err)
        return
    }

    app.jsonResponse(w, http.StatusOK, ApplicationResponse{Application: application})
}
```

For routes pulling user from context (e.g., `setAIPercent` scoping by admin), grab it after URL param validation:

```go
user := getUserFromContext(r.Context())
// ... call store.SetAIPercent(ctx, applicationID, user.ID, req.AIPercent) ...
```

## Method Choice

| Style | Use when |
|-------|----------|
| `PATCH /resource/{id}/status` | Updating a single sub-field of a resource (most common) |
| `PUT /resource/{id}/<field>` | Updating one field, but the convention or naming reads better as PUT (e.g., `ai-percent`) |

Both return 200 (not 204) — the response body carries the updated entity.

## Routes

Mount with the matching role gate:

```go
r.Group(func(r chi.Router) {
    r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin))
    r.Route("/superadmin", func(r chi.Router) {
        r.Route("/applications", func(r chi.Router) {
            r.Patch("/{applicationID}/status", app.setApplicationStatus)
        })
        r.Route("/users", func(r chi.Router) {
            r.Patch("/{userID}/role", app.updateUserRoleHandler)
        })
    })
})
```

Sub-resource paths like `/{id}/status` keep the URL self-describing — easier than overloading PATCH on the parent route.

## Tests

Coverage checklist:

| Case | Expected |
|------|----------|
| Valid value | 200; store called with parsed enum |
| Missing URL param | 400 |
| Invalid value (not in `oneof`) | 400 |
| Resource not found | 404 |
| Store error | 500 |

Inject the URL param via chi route context:

```go
rctx := chi.NewRouteContext()
rctx.URLParams.Add("applicationID", "app-1")
req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
```

See `cmd/api/applications_test.go:548-603` (`TestSetApplicationStatus`) and `cmd/api/superadmin_users_test.go:93-144`.

## What NOT to Do

- Don't accept a free-form string and validate manually — use `validate:"oneof=..."` and fail at the boundary.
- Don't return 204 — clients want the updated resource. PATCH/PUT return 200 with the new state.
- Don't update multiple fields here. If the user wants that, use the resource's main `Update` method (see `crud-resource.md`).
- Don't differentiate "wrong owner" from "not found" with separate error types if you don't want to leak existence info — collapse them into one 404.
