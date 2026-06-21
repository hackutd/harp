# Bulk Operations Pattern

For endpoints that touch many rows in one call: batch assignments, multi-table resets, mass status updates. The handler is thin — almost all logic lives in a transactional store method.

## When to Use

The user wants:
- "Assign all pending X to Y" (work distribution).
- "Reset everything" / "wipe and seed" (multi-table operation).
- "Send/update for all matching rows" (bulk action).

Anything that would be N round-trips if done one at a time, or that needs to commit-or-roll-back as a unit.

Working examples:
- **Batch assign reviews** (`ApplicationReviewsStore.BatchAssign`, `batchAssignReviews`).
- **Hackathon reset** (`HackathonStore.Reset`, `resetHackathonHandler`).

## Store: Transactional, Doubled Timeout

Bulk methods double the standard query timeout because they touch more rows:

```go
ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
defer cancel()

tx, err := s.db.BeginTx(ctx, nil)
if err != nil { return nil, err }
defer tx.Rollback()        // safe — Commit makes Rollback a no-op

// ... do all the work in tx ...

return tx.Commit()
```

`defer tx.Rollback()` is paired with explicit `tx.Commit()` at the end — Go's `database/sql` makes `Rollback` after `Commit` a no-op, so this is the right idiom.

### Pre-flight reads with FOR UPDATE

When reading state to compute the bulk action, lock it so concurrent bulk callers don't collide:

```go
selectQuery := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`
```

For row-locking with skip-on-contention (work-distribution scenarios):

```sql
SELECT id FROM applications
WHERE ...
ORDER BY ...
LIMIT 1
FOR UPDATE SKIP LOCKED      -- different sessions claim different rows
```

### Bulk INSERT via `unnest`

When you have N pairs to insert, build the slices in Go and use one `unnest` query — that's one round-trip instead of N:

```go
var pairAppIDs []string
var pairAdminIDs []string
for _, app := range apps {
    for ... {
        pairAppIDs   = append(pairAppIDs, app.ID)
        pairAdminIDs = append(pairAdminIDs, adminID)
    }
}

if len(pairAppIDs) > 0 {
    insertQuery := `
        INSERT INTO application_reviews (application_id, admin_id)
        SELECT * FROM unnest($1::uuid[], $2::uuid[])
        ON CONFLICT (application_id, admin_id) DO NOTHING
    `
    result, err := tx.ExecContext(ctx, insertQuery, pairAppIDs, pairAdminIDs)
    if err != nil { return nil, err }

    rowsAffected, err := result.RowsAffected()
    if err != nil { return nil, err }
    reviewsCreated = int(rowsAffected)
}
```

`ON CONFLICT ... DO NOTHING` makes re-runs idempotent — important if a partial bulk completed and the user retries.

### Multi-table reset

Order matters when foreign keys are involved. `TRUNCATE ... CASCADE` skips writing N delete rows — but read out anything you need first (e.g., file paths to delete from object storage):

```go
if resetApplications {
    // Collect resume paths BEFORE truncation — we need them for GCS cleanup
    rows, err := tx.QueryContext(ctx, "SELECT resume_path FROM applications WHERE resume_path IS NOT NULL")
    if err != nil { return nil, err }
    defer rows.Close()
    for rows.Next() {
        var path string
        if err := rows.Scan(&path); err != nil { return nil, err }
        resumePaths = append(resumePaths, path)
    }
    if err := rows.Err(); err != nil { return nil, err }
    rows.Close()

    if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE applications CASCADE"); err != nil {
        return nil, err
    }
}
// ... other tables ...
```

### Result struct

Return a small struct of counters / what-was-touched. JSON-render directly:

```go
type BatchAssignmentResult struct {
    ReviewsCreated int `json:"reviews_created"`
}
```

## Handlers

Thin — read inputs, call store, return result.

### POST without body (defaults from settings)

```go
//  @Summary      Batch assign reviews (SuperAdmin)
//  @Tags         superadmin/applications
//  @Router       /superadmin/applications/assign [post]
func (app *application) batchAssignReviews(w http.ResponseWriter, r *http.Request) {
    reviewsPerApp, err := app.store.Settings.GetReviewsPerApplication(r.Context())
    if err != nil { app.internalServerError(w, r, err); return }

    result, err := app.store.ApplicationReviews.BatchAssign(r.Context(), reviewsPerApp)
    if err != nil { app.internalServerError(w, r, err); return }

    app.jsonResponse(w, http.StatusOK, result)
}
```

### POST with options struct

```go
type ResetHackathonPayload struct {
    ResetApplications bool `json:"reset_applications"`
    ResetScans        bool `json:"reset_scans"`
    ResetSchedule     bool `json:"reset_schedule"`
    ResetSettings     bool `json:"reset_settings"`
}

type ResetHackathonResponse struct {
    ResetApplications bool `json:"reset_applications"`
    ResetScans        bool `json:"reset_scans"`
    ResetSchedule     bool `json:"reset_schedule"`
    ResetSettings     bool `json:"reset_settings"`
    ResumesDeleted    int  `json:"resumes_deleted"`
}

func (app *application) resetHackathonHandler(w http.ResponseWriter, r *http.Request) {
    var req ResetHackathonPayload
    if err := readJSON(w, r, &req); err != nil { app.badRequestResponse(w, r, err); return }
    if err := Validate.Struct(req); err != nil  { app.badRequestResponse(w, r, err); return }

    // Cross-field validation: at least one option
    if !req.ResetApplications && !req.ResetScans && !req.ResetSchedule && !req.ResetSettings {
        app.badRequestResponse(w, r, errors.New("at least one reset option must be selected"))
        return
    }

    resumePaths, err := app.store.Hackathon.Reset(r.Context(),
        req.ResetApplications, req.ResetScans, req.ResetSchedule, req.ResetSettings)
    if err != nil { app.internalServerError(w, r, err); return }

    // Async best-effort side-effect (don't block the response on slow GCS calls)
    if len(resumePaths) > 0 && app.gcsClient != nil {
        go func(paths []string) {
            for _, path := range paths {
                _ = app.gcsClient.DeleteObject(context.Background(), path)
            }
        }(resumePaths)
    }

    app.jsonResponse(w, http.StatusOK, ResetHackathonResponse{
        ResetApplications: req.ResetApplications,
        ResetScans:        req.ResetScans,
        ResetSchedule:     req.ResetSchedule,
        ResetSettings:     req.ResetSettings,
        ResumesDeleted:    len(resumePaths),
    })
}
```

For best-effort post-commit work (object-storage cleanup, log shipping, fire-and-forget notifications): spawn a goroutine with `context.Background()`. Don't use `r.Context()` — the request is already done.

## Routes

Bulk operations are almost always super-admin gated:

```go
r.Group(func(r chi.Router) {
    r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin))
    r.Route("/superadmin", func(r chi.Router) {
        r.Post("/reset-hackathon", app.resetHackathonHandler)
        r.Route("/applications", func(r chi.Router) {
            r.Post("/assign", app.batchAssignReviews)
            // ...
        })
    })
})
```

## Tests

Coverage checklist:

| Case | Expected |
|------|----------|
| Success | 200 with result counters; verify all bulk inputs were passed to store |
| Validation (e.g., no options) | 400 |
| Store error | 500 |
| Async side-effect | (mock the side-effect dependency; assert it was called the right number of times) |

```go
func TestBatchAssignReviews(t *testing.T) {
    app := newTestApplication(t)
    mockReviews  := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
    mockSettings := app.store.Settings.(*store.MockSettingsStore)

    result := &store.BatchAssignmentResult{ReviewsCreated: 15}
    mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
    mockReviews.On("BatchAssign", 3).Return(result, nil).Once()

    req, _ := http.NewRequest(http.MethodPost, "/", nil)
    req = setUserContext(req, newSuperAdminUser())

    rr := executeRequest(req, http.HandlerFunc(app.batchAssignReviews))
    checkResponseCode(t, http.StatusOK, rr.Code)

    var body struct{ Data store.BatchAssignmentResult `json:"data"` }
    require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
    assert.Equal(t, 15, body.Data.ReviewsCreated)
}
```

Async cleanup is hard to assert deterministically — keep the goroutine logic simple, and test the synchronous outputs (the response body, the store calls).

## What NOT to Do

- Don't run N inserts in a loop — build slices and `unnest` once.
- Don't skip `ON CONFLICT DO NOTHING` for idempotency — partial bulk completes plus user retries are normal.
- Don't truncate without first reading any "external" pointers (file paths, third-party IDs) you'll need for cleanup.
- Don't block the response on best-effort cleanup — fire a goroutine with `context.Background()`.
- Don't keep the standard 5s timeout — bulk operations need `QueryTimeoutDuration*2` (or longer if you've measured).
