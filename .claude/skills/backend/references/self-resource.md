# Self-Resource Pattern (`/me` endpoints)

For resources where each user has their own copy and manages it themselves. Examples: hacker application (`/applications/me`).

Distinguishing features vs. CRUD:
- Resource is scoped by `user.ID` from the auth context, never by URL param.
- "Get-or-create" is the typical entry point.
- A state machine governs writability (e.g., `draft` mutable, `submitted` frozen).
- `/submit` (or similar transition) is a domain-specific verb, not a generic update.

## When to Use

User says "users should be able to manage their own X" / "applicants edit their application" / "members configure their profile". The handler reads the user from context and never trusts an ID from the URL or body.

Working example: **Applications** (`internal/store/applications.go`, `cmd/api/applications.go`).

## 1. Migration

The table has a unique index on `user_id` (one row per user) and may include a status column with an enum type.

```sql
-- 000NNN_add_application_types.up.sql (separate migration for the enum)
CREATE TYPE application_status AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'waitlisted');

-- 000NNN+1_add_applications.up.sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'draft',
    responses JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Enum types live in their own migration (separate from the table that uses them). The unique constraint on `user_id` enables the get-or-create race recovery below.

## 2. Store

### Model with status enum

```go
type ApplicationStatus string

const (
    StatusDraft      ApplicationStatus = "draft"
    StatusSubmitted  ApplicationStatus = "submitted"
    StatusAccepted   ApplicationStatus = "accepted"
    StatusRejected   ApplicationStatus = "rejected"
    StatusWaitlisted ApplicationStatus = "waitlisted"
)

type Application struct {
    ID          string            `json:"id"`
    UserID      string            `json:"user_id"`
    Status      ApplicationStatus `json:"status"`
    Responses   json.RawMessage   `json:"responses"`
    SubmittedAt *time.Time        `json:"submitted_at"`
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}
```

### GetByUserID, Create, Update — standard

`GetByUserID` returns `ErrNotFound` on `sql.ErrNoRows`. `Create` only requires `user_id` (other fields default in SQL). Translate the unique-constraint violation to `ErrConflict`:

```go
func (s *ApplicationsStore) Create(ctx context.Context, app *Application) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    err := s.db.QueryRowContext(ctx, `
        INSERT INTO applications (user_id) VALUES ($1)
        RETURNING id, status, responses, created_at, updated_at
    `, app.UserID).Scan(&app.ID, &app.Status, &app.Responses, &app.CreatedAt, &app.UpdatedAt)
    if err != nil {
        if strings.Contains(err.Error(), "applications_user_id_key") {
            return ErrConflict       // race: another request created it
        }
        return err
    }
    return nil
}
```

### State-transition method (Submit)

Constrain via SQL `WHERE status = 'draft'` so concurrent submits become idempotent. `sql.ErrNoRows` here means *not in draft* — return `ErrConflict`:

```go
func (s *ApplicationsStore) Submit(ctx context.Context, app *Application) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    err := s.db.QueryRowContext(ctx, `
        UPDATE applications
        SET status = 'submitted', submitted_at = NOW()
        WHERE id = $1 AND status = 'draft'
        RETURNING status, submitted_at, updated_at
    `, app.ID).Scan(&app.Status, &app.SubmittedAt, &app.UpdatedAt)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return ErrConflict
        }
        return err
    }
    return nil
}
```

## 3. Handlers

### Get-or-Create

```go
func (app *application) getOrCreateApplicationHandler(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user == nil {
        app.unauthorizedErrorResponse(w, r, nil)
        return
    }

    application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            // Create a new draft
            application = &store.Application{UserID: user.ID}
            if err := app.store.Application.Create(r.Context(), application); err != nil {
                if errors.Is(err, store.ErrConflict) {
                    // Race: another request created it. Refetch.
                    application, err = app.store.Application.GetByUserID(r.Context(), user.ID)
                    if err != nil {
                        app.internalServerError(w, r, err)
                        return
                    }
                } else {
                    app.internalServerError(w, r, err)
                    return
                }
            }
        } else {
            app.internalServerError(w, r, err)
            return
        }
    }
    // ... build response, possibly embedding related data ...
    app.jsonResponse(w, http.StatusOK, application)
}
```

The race recovery is non-obvious but important — without it, two concurrent first-time loads can fail. **Always include it for `/me` resources with a unique constraint on `user_id`.**

### Update with state guard

Patch-shape body so partial updates work; reject if the resource has left the editable state:

```go
type UpdateApplicationPayload struct {
    Responses  json.RawMessage `json:"responses"`     // pointer-like via RawMessage
    ResumePath *string         `json:"resume_path"`   // *string for nullable field
}

func (app *application) updateApplicationHandler(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user == nil { app.unauthorizedErrorResponse(w, r, nil); return }

    application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("application not found"))
            return
        }
        app.internalServerError(w, r, err)
        return
    }
    if application.Status != store.StatusDraft {
        app.conflictResponse(w, r, errors.New("cannot update submitted application"))
        return
    }

    var req UpdateApplicationPayload
    if err := readJSON(w, r, &req); err != nil {
        app.badRequestResponse(w, r, err)
        return
    }

    // Apply only fields present in the request
    if req.Responses != nil   { application.Responses = req.Responses }
    if req.ResumePath != nil  { application.ResumePath = req.ResumePath }

    if err := app.store.Application.Update(r.Context(), application); err != nil {
        app.internalServerError(w, r, err)
        return
    }
    app.jsonResponse(w, http.StatusOK, application)
}
```

For PATCH-style endpoints, use `json.RawMessage` (for opaque blobs) and `*T` (for nullable scalars) — checking `!= nil` lets you distinguish "field absent" from "field set to zero value". Don't use validate tags meant for required POST bodies.

### Submit (state-transition verb)

Run domain validation before flipping state; the store call itself enforces "must be in draft":

```go
func (app *application) submitApplicationHandler(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user == nil { app.unauthorizedErrorResponse(w, r, nil); return }

    application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("application not found"))
            return
        }
        app.internalServerError(w, r, err)
        return
    }
    if application.Status != store.StatusDraft {
        app.conflictResponse(w, r, errors.New("application already submitted"))
        return
    }

    // Domain validation (e.g., schema-driven, business-rule checks)
    if errs := validateAgainstSchema(/* ... */); len(errs) > 0 {
        app.badRequestResponse(w, r, fmt.Errorf("validation errors: %v", errs))
        return
    }

    if err := app.store.Application.Submit(r.Context(), application); err != nil {
        app.internalServerError(w, r, err)
        return
    }
    app.jsonResponse(w, http.StatusOK, application)
}
```

## 4. Routes

Mount under `AuthRequiredMiddleware`. Often gated by a settings middleware (e.g., `ApplicationsEnabledMiddleware`):

```go
r.Group(func(r chi.Router) {
    r.Use(app.AuthRequiredMiddleware)

    r.Route("/applications", func(r chi.Router) {
        r.Get("/me", app.getOrCreateApplicationHandler)
        r.Get("/enabled", app.getApplicationsEnabled)

        r.Group(func(r chi.Router) {
            r.Use(app.ApplicationsEnabledMiddleware)
            r.Patch("/me", app.updateApplicationHandler)
            r.Post("/me/submit", app.submitApplicationHandler)
            // file upload endpoints go here too — see file-storage.md
        })
    })
})
```

## 5. Tests

Coverage checklist:

| Handler | Cases |
|---------|-------|
| Get-or-Create | returns existing, creates draft when none, handles race (Create returns Conflict → re-fetches) |
| Update | success, 409 when not in editable state, 404 when no resource, 400 on bad JSON |
| Submit (or other state transition) | success, 409 when not in editable state, 404 when no resource, 400 on validation failure |

The race recovery test uses three calls in order:

```go
mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()
mockApps.On("Create", mock.AnythingOfType("*store.Application")).Return(store.ErrConflict).Once()
mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
```

See `cmd/api/applications_test.go` for the full set. Inject the user with `setUserContext(req, user)` — see `testing.md`.

## What NOT to Do

- Don't accept the resource ID via URL — read it via `user.ID` from context, then look up the resource.
- Don't allow direct `Update` from a `submitted`/`accepted` state — gate at the handler AND in SQL.
- Don't replace `responses` blindly — for PATCH-style updates, only apply fields that are present in the request body.
- Don't skip the conflict-recovery branch in get-or-create — silent failures under load.
