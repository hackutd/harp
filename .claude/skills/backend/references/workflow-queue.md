# Workflow Queue Pattern

For features where work items are claimed by an admin, processed, and submitted. Examples: application reviews (`pending` → `next` → `submit` → `completed`).

## When to Use

You have a stream of work items distributed across many admins, and:
- An admin wants to **see what's assigned to them** (pending list).
- An admin wants the **next item to work on** (atomic claim from a queue).
- An admin **submits a result** that closes the item.
- An admin wants to **see what they've already done** (completed list).

There's also a separate "batch assign" pattern (super-admin pre-distributes work) — that lives in `bulk-operations.md`.

Working example: **Application Reviews** (`internal/store/reviews.go`, `cmd/api/reviews.go`).

## Data Model

A join table between the work-target and the assigned admin, with a nullable result column:

```sql
CREATE TABLE application_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    admin_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote           review_vote,            -- nullable: NULL = pending, set = completed
    notes          TEXT,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, admin_id)       -- prevent double-assign
);
```

The unique pair `(target_id, admin_id)` is critical — it makes assignments idempotent and lets `ON CONFLICT DO NOTHING` work in the bulk-assign pattern.

## Store Methods

### Pending list (per admin)

```go
func (s *ApplicationReviewsStore) GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
    // SELECT ar.*, joined application + user fields ...
    // WHERE ar.admin_id = $1 AND ar.vote IS NULL
    // ORDER BY ar.assigned_at ASC
}
```

Pending = `vote IS NULL`. Order oldest-first. Hydrate with relevant target details (joined applicant info) so the admin can review without a second round-trip.

### Completed list (per admin)

```go
// WHERE ar.admin_id = $1 AND ar.vote IS NOT NULL
// ORDER BY ar.reviewed_at DESC
```

Completed = `vote IS NOT NULL`. Order most-recent-first.

### Atomic claim (`AssignNextForAdmin`)

The critical operation. Wrap in a transaction so concurrent admins don't claim the same item.

```go
func (s *ApplicationReviewsStore) AssignNextForAdmin(ctx context.Context, adminID string, reviewsPerApp int) (*ApplicationReview, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil { return nil, err }
    defer tx.Rollback()

    // 1) Find next eligible target — locked, skipped if another tx holds it
    findQuery := `
        SELECT id FROM applications
        WHERE status = 'submitted'
          AND reviews_assigned < $1
          AND user_id != $2                        -- no self-review
          AND NOT EXISTS (
              SELECT 1 FROM application_reviews ar
              WHERE ar.application_id = applications.id AND ar.admin_id = $2
          )
        ORDER BY reviews_assigned ASC, submitted_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED                     -- key clause: concurrent claims don't collide
    `
    var applicationID string
    if err := tx.QueryRowContext(ctx, findQuery, reviewsPerApp, adminID).Scan(&applicationID); err != nil {
        if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
        return nil, err
    }

    // 2) Insert assignment, idempotent on uniqueness collision
    insertQuery := `
        INSERT INTO application_reviews (application_id, admin_id)
        VALUES ($1, $2)
        ON CONFLICT (application_id, admin_id) DO NOTHING
        RETURNING id, application_id, admin_id, vote, notes, assigned_at, reviewed_at, created_at, updated_at
    `
    var review ApplicationReview
    if err := tx.QueryRowContext(ctx, insertQuery, applicationID, adminID).Scan(/* ... */); err != nil {
        if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
        return nil, err
    }

    if err := tx.Commit(); err != nil { return nil, err }
    return &review, nil
}
```

Key clauses:
- `FOR UPDATE SKIP LOCKED` — locks the row for this transaction; if another transaction has it, skip and try the next.
- `ORDER BY reviews_assigned ASC, submitted_at ASC` — workload balancing across the queue.
- `user_id != $2` — admins don't review their own submissions.
- `NOT EXISTS (... AND admin_id = $2)` — same admin can't be assigned the same item twice.
- `ON CONFLICT ... DO NOTHING` — safety net; the unique constraint enforces it.

### Submit result

```go
func (s *ApplicationReviewsStore) SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, notes *string) (*ApplicationReview, error) {
    // UPDATE application_reviews
    // SET vote = $3, notes = $4, reviewed_at = NOW(), updated_at = NOW()
    // WHERE id = $1 AND admin_id = $2
    // RETURNING ...
}
```

Scope by `(reviewID, adminID)` so admins can only submit on their own assignments — `sql.ErrNoRows` covers both "not found" and "wrong owner" with one error path.

A trigger on the table updates the parent's `accept_votes`/`reject_votes`/`reviews_completed` columns automatically (see migration 000011) — handler doesn't need to maintain those.

## Handlers

### Pending / Completed lists

```go
//  @Summary  Get pending reviews (Admin)
//  @Tags     admin/reviews
//  @Router   /admin/reviews/pending [get]
func (app *application) getPendingReviews(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    reviews, err := app.store.ApplicationReviews.GetPendingByAdminID(r.Context(), user.ID)
    if err != nil { app.internalServerError(w, r, err); return }
    app.jsonResponse(w, http.StatusOK, PendingReviewsListResponse{Reviews: reviews})
}
```

`user.ID` from context — never trust an admin ID from query/body.

### Claim next

May call into a settings dependency (e.g., reviews-per-app) before claiming:

```go
//  @Router   /admin/reviews/next [get]
func (app *application) getNextReview(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())

    reviewsPerApp, err := app.store.Settings.GetReviewsPerApplication(r.Context())
    if err != nil { app.internalServerError(w, r, err); return }

    review, err := app.store.ApplicationReviews.AssignNextForAdmin(r.Context(), user.ID, reviewsPerApp)
    if err != nil {
        switch {
        case errors.Is(err, store.ErrNotFound):
            app.notFoundResponse(w, r, errors.New("no applications need review"))
        default:
            app.internalServerError(w, r, err)
        }
        return
    }
    app.jsonResponse(w, http.StatusOK, ReviewResponse{Review: *review})
}
```

`ErrNotFound` here means "queue is empty, try again later" — surface that as 404 with a specific message.

### Submit

Standard payload validation, then delegate to the scoped store method:

```go
type SubmitVotePayload struct {
    Vote  store.ReviewVote `json:"vote"  validate:"required,oneof=accept reject waitlist"`
    Notes *string          `json:"notes" validate:"omitempty,max=1000"`
}

func (app *application) submitVote(w http.ResponseWriter, r *http.Request) {
    reviewID := chi.URLParam(r, "reviewID")
    if reviewID == "" {
        app.badRequestResponse(w, r, errors.New("review ID is required"))
        return
    }
    user := getUserFromContext(r.Context())

    var req SubmitVotePayload
    if err := readJSON(w, r, &req); err != nil { app.badRequestResponse(w, r, err); return }
    if err := Validate.Struct(req); err != nil  { app.badRequestResponse(w, r, err); return }

    review, err := app.store.ApplicationReviews.SubmitVote(r.Context(), reviewID, user.ID, req.Vote, req.Notes)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) { app.notFoundResponse(w, r, err); return }
        app.internalServerError(w, r, err)
        return
    }
    app.jsonResponse(w, http.StatusOK, ReviewResponse{Review: *review})
}
```

Use `oneof=` validation for the result enum so anything outside the allowed set is rejected at the boundary.

## Routes

Mount under the admin role group:

```go
r.Group(func(r chi.Router) {
    r.Use(app.RequireRoleMiddleware(store.RoleAdmin))

    r.Route("/admin", func(r chi.Router) {
        r.Route("/reviews", func(r chi.Router) {
            r.Get("/pending",   app.getPendingReviews)
            r.Get("/next",      app.getNextReview)
            r.Put("/{reviewID}", app.submitVote)
            r.Get("/completed", app.getCompletedReviews)
        })
    })
})
```

## Tests

Coverage checklist:

| Endpoint | Cases |
|----------|-------|
| Pending list | returns items, returns empty list |
| Completed list | returns items |
| Claim next | success returns review, 404 when queue empty, 500 on store error |
| Submit | success (with and without notes), 400 invalid vote, 404 not found / not yours |

For `submitVote`, mock the user-scoped variant — assert the admin ID is passed:

```go
mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, (*string)(nil)).Return(review, nil).Once()
```

See `cmd/api/reviews_test.go`.

## What NOT to Do

- Don't claim work without `FOR UPDATE SKIP LOCKED` — concurrent admins WILL collide.
- Don't drop the unique `(target_id, admin_id)` constraint — bulk re-assign and idempotent claim both rely on it.
- Don't trust an admin ID from URL/body — pull it from `getUserFromContext`.
- Don't update parent counter columns from the handler — the trigger handles that.
- Don't return all reviews to all admins — every retrieval method is scoped by `admin_id`.
