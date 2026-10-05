# Workflow Queue Pattern

For features where work items are claimed by an admin, processed, and submitted. Examples: application reviews (`pending` → `submit` → `completed`, then `claim` for more).

## When to Use

You have a stream of work items distributed across many admins, and:
- An admin wants to **see what's assigned to them** (pending list).
- An admin who has **finished their queue wants more** (atomic claim).
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

### Claim more (`ClaimForAdmin`)

The critical operation. Once an admin's queue is empty, it hands them up to `limit` more items in one transaction and returns how many it claimed. Two sources, in order:

1. **Fill a slot** — a submitted application still below the reviews-per-application target gets a new row (`INSERT`, the trigger bumps `reviews_assigned`).
2. **Take over** — when nothing is below target (the normal state right after a batch run), move an unstarted review from another holder by updating its `admin_id`. Holders who can no longer review (demoted, or a super admin with assignment off) go first; then the longest queue, taking from its end. The total per application never changes.

```go
func (s *ApplicationReviewsStore) ClaimForAdmin(ctx context.Context, adminID string, reviewsPerApp, limit int) (int, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2) // several statements
    defer cancel()
    tx, err := s.db.BeginTx(ctx, nil)
    // ...
    defer tx.Rollback()

    // 1) Serialize: lock the same settings row BatchAssign locks (create it if missing).
    //    Claims run one at a time and never alongside a batch; the row also yields the
    //    disabled super admins via parseReviewAssignmentEntries + disabledReviewerIDs.
    //    INSERT INTO settings (key, value) VALUES ($1, '[]') ON CONFLICT (key) DO NOTHING
    //    SELECT value FROM settings WHERE key = $1 FOR UPDATE

    // 2) Refuse while the admin still has visible pending work -> ErrConflict
    //    (vote IS NULL AND a.status = 'submitted', same visibility as GetPendingByAdminID)

    // 3) for claimed < limit:
    //    a) fill: SELECT id FROM applications WHERE status = 'submitted' AND reviews_assigned < $target
    //       AND user_id != $admin AND NOT EXISTS (row for this admin)
    //       ORDER BY reviews_assigned, submitted_at, id LIMIT 1 FOR UPDATE SKIP LOCKED  -> INSERT
    //    b) else take over (CTE counts each holder's pending and flags orphaned holders):
    //       ... AND (h.orphaned OR h.pending >= claimed + 2)
    //       ORDER BY h.orphaned DESC, h.pending DESC, ar.assigned_at DESC, ar.id DESC
    //       LIMIT 1 FOR UPDATE OF ar SKIP LOCKED
    //       -> UPDATE application_reviews SET admin_id = $admin, assigned_at = NOW() WHERE id = $1
    //    c) neither -> stop
    return claimed, tx.Commit()
}
```

Key clauses:
- **Settings row `FOR UPDATE`** — without one lock shared by every claim, two admins claiming at once each see a holder's whole queue and can drain it together; a double click could pass the empty-queue check twice.
- **Balance rule `pending >= claimed + 2`** — a holder only gives a review up while they would still have more than the claimer, so work never bounces between two admins and nobody loses the review they are down to. Orphaned holders are exempt.
- **Take from the end of the queue** — queues are graded from the front (`ORDER BY assigned_at, id`), so the last row is the one least likely to be open on the holder's screen.
- **`UPDATE`, not delete + insert** — `vote`/`travel_vote` stay NULL, so the counter trigger leaves `reviews_assigned` alone.
- `user_id != admin` and `NOT EXISTS (row for this admin)` — no self-review, and the unique `(application_id, admin_id)` pair is never violated.
- `SKIP LOCKED` — a vote in flight on a row locks it; skip rather than wait.

A holder who votes on a review that moved gets `ErrVoteNotApplied` → 404 from `submitVote`; the grading UI drops it from the queue and moves on.

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

### Claim more

Gate super admins on their assignment toggle, read the target, claim, then return the admin's new queue:

```go
const reviewClaimBatchSize = 5

type ClaimReviewsResponse struct {
    Claimed int                                  `json:"claimed"`
    Reviews []store.ApplicationReviewWithDetails `json:"reviews"`
}

//  @Router   /admin/reviews/claim [post]
func (app *application) claimReviews(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user.Role == store.RoleSuperAdmin {
        // GetReviewAssignmentToggle -> forbiddenMessageResponse when off
    }

    reviewsPerApp, err := app.store.Settings.GetReviewsPerApplication(r.Context())
    if err != nil { app.internalServerError(w, r, err); return }

    claimed, err := app.store.ApplicationReviews.ClaimForAdmin(r.Context(), user.ID, reviewsPerApp, reviewClaimBatchSize)
    if err != nil {
        switch {
        case errors.Is(err, store.ErrConflict):
            app.conflictResponse(w, r, errors.New("finish your assigned reviews before claiming more"))
        default:
            app.internalServerError(w, r, err)
        }
        return
    }

    reviews, err := app.store.ApplicationReviews.GetPendingByAdminID(r.Context(), user.ID)
    if err != nil { app.internalServerError(w, r, err); return }
    app.jsonResponse(w, http.StatusOK, ClaimReviewsResponse{Claimed: claimed, Reviews: reviews})
}
```

Claiming nothing is a 200 with `claimed: 0` — "up to N" coming back empty is not an error. It is a POST: it changes assignments.

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
            r.Post("/claim",    app.claimReviews)
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
| Claim more | success returns claimed count + queue, 200 with `claimed: 0`, 409 while queue non-empty, 403 for a super admin with assignment off, 500 on store error |
| Submit | success (with and without notes), 400 invalid vote, 404 not found / not yours |

For `submitVote`, mock the user-scoped variant — assert the admin ID is passed:

```go
mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, (*string)(nil)).Return(review, nil).Once()
```

See `cmd/api/reviews_test.go`.

## What NOT to Do

- Don't claim work without `FOR UPDATE SKIP LOCKED` and the shared settings-row lock — concurrent admins WILL collide.
- Don't drop the unique `(target_id, admin_id)` constraint — bulk re-assign and idempotent claim both rely on it.
- Don't trust an admin ID from URL/body — pull it from `getUserFromContext`.
- Don't update parent counter columns from the handler — the trigger handles that.
- Don't return all reviews to all admins — every retrieval method is scoped by `admin_id`.
