# Walk-In Queue — Implementation Plan

> **Branch target:** feature/walk-in-queue → main
> **Status:** Planning (Phase 1 investigation complete)

---

## Overview

Add a walk-in queue for at-event registration. Walk-ins are typically applicants who were
`rejected` through normal review but show up at the door anyway. The flow is a three-stage
state machine:

```
rejected  --walk-in scan-->  waitlisted (+ FIFO position N)  --promote-->  accepted  --check-in scan-->  checked in
```

1. **Walk-in scan:** admin scans the applicant's QR; they join a FIFO queue, status flips
   to `waitlisted`, and they receive a "you're #N in the queue" email.
2. **Promote:** super admin calls "promote the first N walk-ins"; those users flip to
   `accepted` and receive an acceptance email with their QR code.
3. **Check-in scan:** promoted users walk to the main check-in scanner. The scanner
   enforces `status='accepted'` before allowing check-in (Step 5d) — so anyone who hasn't
   been promoted yet is cleanly blocked at the door.

The queue lives in a dedicated `walk_ins` table. The `waitlisted` middle state serves the
admin dashboard (shows queue positions) and is what gates the check-in scanner from
admitting un-promoted people. The queue and the application status are kept as separate
concerns — `walk_ins` tracks arrival order and promotion audit trail; `application_status`
tracks outcome.

---

## Phase 1 Decisions (Resolved)

These were open questions from the investigation phase. All are resolved before implementation begins.

### 1. Do walk-ins always have a `users` row?

**Finding:** Users are created exclusively in `internal/auth/user_sync.go:CreateUserFromSession()`,
called only after a successful SuperTokens authentication. The `scans.user_id` column is
`NOT NULL` with a hard FK to `users(id) ON DELETE CASCADE`. A true drop-in with no prior
registration has no `users` row and cannot be scanned today.

**Decision: Require prior registration (Option A).**

Walk-ins must have authenticated via the portal before the event. The QR code printed or
shown at the door encodes their `user_id`. This is consistent with every other scan in the
system and avoids rebuilding auth at event time. A "create user from scan" path (Option B)
is out of scope.

**Implication:** If an admin attempts to scan an unknown QR, the existing FK violation path
already returns 404 "user not found" — no new error handling needed.

---

### 2. Queue semantics on re-scan

**Finding:** The `scans` table already enforces `UNIQUE(user_id, scan_type)` — a duplicate
scan hits `ErrConflict` → 409. The `walk_ins` table will have `UNIQUE(user_id)`.

**Decision: Idempotent no-op.**

A second walk-in scan for the same user returns 200 without re-inserting a queue row or
re-sending the queued email. The admin UI can surface this as "already queued" using the
existing 409 scan conflict, or the handler can silently absorb it — to be decided during
implementation. The key invariant is: `queued_at` is never overwritten on re-scan.

---

### 3. Promotion overriding prior application status

**Finding:** `applications.SetStatus()` in `internal/store/applications.go` accepts any of
`accepted`, `rejected`, `waitlisted` with no guard on prior state. A rejected applicant can
already be flipped to `accepted` through the existing super admin endpoint.

**Decision: Allow override with no guard.**

In the normal walk-in flow, the prior status at promotion is always `waitlisted` (set by
`Enqueue` at scan time — see Decision 4b). Promotion flips `waitlisted` → `accepted`.

The store-level upsert (Step 4) doesn't guard against other prior statuses either — if
state somehow drifts (e.g. a row is `draft` or `rejected` at promotion time), promotion
still forces it to `accepted`. This is defense-in-depth, not the happy path. Product has
signed off that walk-in acceptance is an intentional operator override regardless of
prior state.

---

### 4. Application row stub for users who never opened the form

**Finding:** Application rows are created lazily on first access to `GET /applications/me`.
A user who registered (authenticated) but never opened the application form has no
application row at all. A user who opened the form but never submitted has a row with
`status = 'draft'` and `submitted_at = NULL`. The DB has a constraint that
`submitted_at NOT NULL` when `status != 'draft'`.

**Decision: Stub the row in `Enqueue` (scan time), not in promotion.**

`Enqueue` (Step 3) uses an atomic `INSERT ... ON CONFLICT DO UPDATE` to upsert the
applications row to `status='waitlisted'` at scan time. This means by the time promotion
runs, the row always exists with `status='waitlisted'` — promotion is just a simple
status flip to `accepted` (Step 4).

The atomic upsert handles three cases in a single statement:
- **No row exists** (never opened the form): INSERT runs, `submitted_at=NOW()`,
  `responses='{}'`.
- **Existing draft** (`submitted_at IS NULL`): UPDATE, `COALESCE` picks NOW() for
  `submitted_at`.
- **Existing submitted/rejected/waitlisted**: UPDATE, `COALESCE` preserves the original
  `submitted_at`.

A stubbed application has empty `responses` and is clearly distinguishable from a
submitted one, but it is queryable and shows up in the admin list correctly.

**Downstream audit needed:** Before implementation, grep all read paths that touch
`applications.responses` — admin all-applicants page, reviews list, applicant detail
view, CSV exports. An empty-object `responses` may render badly (blank fields) or crash
code that assumes specific keys exist. This applies to both `Enqueue` (Step 3) and the
fallback in `PromoteNext` (Step 4). If any read path is brittle, either:
(a) populate sentinel keys in the stub (e.g. `{"_walk_in": true}`) and have the UI
handle them, or (b) harden the read paths to tolerate missing keys.

---

### 4b. Application status on walk-in scan

**Decision: Walk-in scan flips application status to `waitlisted`.**

When the walk-in QR is scanned, the user enters a `waitlisted` state in addition to
being enqueued. This gives the walk-in flow a clean state machine:

```
[any prior status]  --scan-->  waitlisted  --promote-->  accepted
                                ^
                                |
                                + draft, submitted, rejected, waitlisted all transition here
                                + accepted is the exception (see short-circuit below)
```

Behaviorally:
- Hacker who never applied → stubbed with `status='waitlisted'`.
- Hacker with `draft` → flipped to `waitlisted`, `submitted_at` set.
- Hacker with `submitted` → flipped to `waitlisted`.
- Hacker with `rejected` → flipped to `waitlisted` (operator override at scan time; same intent as decision 3's promotion override, applied earlier in the flow).
- Hacker with `waitlisted` → no-op on status, still enqueued.
- Hacker with `accepted` → **short-circuit**: do not enqueue, do not change status,
  no email sent. They're already in. Returns `(false, nil)` from `Enqueue`.

This means the same atomic upsert pattern in Step 4 is also used in `Enqueue` — just
with `status='waitlisted'` instead of `status='accepted'`. Promotion (Step 4) then
flips `waitlisted` → `accepted`.

### 4c. Queue position number

The walk-in's position in the FIFO queue is surfaced in two places:

- **Queued email:** the user is told their position at the moment of scan
  (e.g. "you're #7 in the walk-in queue"). This is a snapshot — it can decrease over
  time as people ahead are promoted, but the email reflects state at enqueue time.
- **Super admin dashboard:** the queue list shows each user's live position. This is
  computed on read via `ROW_NUMBER() OVER (ORDER BY queued_at ASC, id ASC)` and is
  always accurate at query time.

Position is **derived**, not stored. Storing it would create stale-data bugs every time
someone is promoted (every position would need shifting). The `idx_walk_ins_fifo` index
already makes `ROW_NUMBER` cheap for queue-sized result sets.

---

### 5. Email copy

Two new transactional emails are needed:

| Email | Trigger | Key content |
|---|---|---|
| `walk_in_queued` | Walk-in QR scanned, user joins queue | "You're in the queue — we'll email you if you're accepted" |
| `walk_in_accepted` | Super admin promotes N walk-ins | Congrats + QR code (same structure as existing `qr_email.html`) |

`walk_in_accepted` can reuse the QR generation logic from `SendQREmail`; only the subject
line and body copy differ. `walk_in_queued` is a net-new template.

**Blocking:** Body copy for both emails must come from ops/marketing before the mailer work
can be finalized. Template HTML structure can be scaffolded ahead of time.

---

## Architecture Decisions

### Why a dedicated `walk_ins` table

Three options were considered:

- **Option A — Add a new `walk_in` enum value to `application_status`**: Rejected.
  The status enum drives the review grading workflow. A bespoke walk-in value has no
  place in the review pipeline and would require guards everywhere status transitions
  are validated. Note: the walk-in flow *does* touch `application_status` — it reuses
  the existing `waitlisted` and `accepted` values. The rejection here is specifically
  about adding a *new* enum value, not about leaving status untouched.

- **Option B — Encode as scan records** (query scan table for walk-in category): Rejected.
  Scans are an audit log — they are immutable and have no "promotion" concept. Encoding
  queue state as scan records fights the scan model and makes FIFO ordering and promotion
  stamping awkward.

- **Option C — Dedicated `walk_ins` table** (chosen): Walk-in queue is a first-class entity.
  `queued_at` gives natural FIFO ordering. `promoted_at` and `promoted_by` give a clean
  audit trail. No existing models are polluted.

### Scan record is still created

When a walk-in QR is scanned, two writes happen:
1. A row in `walk_ins` (queue entry).
2. A row in `scans` (audit record, same as all other scan types).

Both are written. The scan record is needed for stats, the scan history view, and
consistency with how every other scan type works.

---

## Implementation Steps

Steps are ordered by dependency. Each step is independently testable before the next begins.

---

### Step 1 — New `walk_in` scan category

**Files:** `internal/store/scans.go`

Add the constant alongside existing category constants:

```go
const (
    ScanCategoryCheckIn = "check_in"
    ScanCategoryMeal    = "meal"
    ScanCategorySwag    = "swag"
    ScanCategoryOther   = "other"
    ScanCategoryWalkIn  = "walk_in"  // new
)
```

Extend the `validate:"oneof=..."` tag on `ScanType.Category` to include `walk_in`.

**Why first:** Every subsequent step that touches scan types or the `createScanHandler`
depends on this constant existing. It is a zero-risk change.

---

### Step 2 — Migrations

> **Numbering note:** Migration `000015_seed_admin_sponsor_edit_enabled` already exists
> on `main` (from the prior sponsor edit branch). The next free numbers are `000016`
> and `000017`. If additional migrations land on `main` before this branch merges, the
> numbers must shift accordingly — `golang-migrate` will fail loudly on duplicate
> versions, so this is a mechanical fix at rebase time.

> **UUID generation:** This plan uses `gen_random_uuid()` (Postgres 13+ builtin /
> `pgcrypto`). Before writing the migration, grep existing migrations to confirm the
> prevailing convention — if the repo uses `uuid_generate_v4()` from `uuid-ossp`,
> match that instead. Mismatched UUID functions across tables work, but consistency
> is better.

#### Migration 16 — `walk_ins` table

**File:** `cmd/migrate/migrations/000016_add_walk_ins.up.sql`

```sql
CREATE TABLE walk_ins (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    queued_at   timestamptz NOT NULL DEFAULT NOW(),
    promoted_at timestamptz,
    promoted_by uuid        REFERENCES users(id) ON DELETE SET NULL
);

-- FIFO index: un-promoted rows first (promoted_at NULLS FIRST), then arrival order
CREATE INDEX idx_walk_ins_fifo ON walk_ins (promoted_at NULLS FIRST, queued_at ASC);
```

**File:** `cmd/migrate/migrations/000016_add_walk_ins.down.sql`

```sql
DROP TABLE IF EXISTS walk_ins;
```

**Notes on schema choices:**

- `user_id UNIQUE` enforces one queue slot per user. Re-scan hits the unique constraint
  and is handled as a no-op via `ON CONFLICT DO NOTHING` in the store.
- `promoted_by REFERENCES users(id) ON DELETE SET NULL` — if the promoting admin is ever
  deleted, the audit record is preserved but the FK is nulled rather than cascading.
- The composite index `(promoted_at NULLS FIRST, queued_at ASC)` means the `PromoteNext`
  query (`WHERE promoted_at IS NULL ORDER BY queued_at ASC`) uses the index efficiently
  and avoids a full table scan.

#### Migration 17 — `walk_in` scan type seed

**File:** `cmd/migrate/migrations/000017_add_walkin_scan_type.up.sql`

For existing deployments, upsert the walk-in scan type into the `settings` JSONB array:

```sql
UPDATE settings
SET value = value || '[{"name":"walk_in","display_name":"Walk-In","category":"walk_in","is_active":true}]'::jsonb
WHERE key = 'scan_types'
  AND NOT (value @> '[{"name":"walk_in"}]'::jsonb);
```

The `NOT (value @> ...)` guard makes this idempotent — safe to re-run.

**File:** `cmd/migrate/migrations/000017_add_walkin_scan_type.down.sql`

```sql
UPDATE settings
SET value = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(value) AS elem
    WHERE elem->>'name' != 'walk_in'
)
WHERE key = 'scan_types';
```

**Also update:** `cmd/migrate/migrations/000006_seed_settings.up.sql`

Add the `walk_in` type to the default `scan_types` JSON array so fresh installs get it
without needing migration 17. This keeps fresh install and migrated install state in sync.

---

### Step 3 — Store: `internal/store/walkins.go`

New file with a `WalkInsStore` struct backed by `*sql.DB`.

#### Interface (add to `internal/store/storage.go`)

```go
type WalkInsStore interface {
    // Enqueue returns (inserted, position, err).
    //   inserted=true on first enqueue, false on re-scan or short-circuit.
    //   position is the user's 1-indexed FIFO position at enqueue time
    //     (only meaningful when inserted=true; 0 otherwise).
    // Runs as a single transaction that:
    //   1. Short-circuits if applications.status='accepted' (returns (false, 0, nil)).
    //   2. Inserts walk_ins row (ON CONFLICT DO NOTHING; conflict returns inserted=false).
    //   3. Upserts applications to status='waitlisted'.
    //   4. Computes position via ROW_NUMBER.
    Enqueue(ctx context.Context, userID string) (inserted bool, position int, err error)
    PromoteNext(ctx context.Context, count int, promotedBy string) ([]User, error)
    QueueDepth(ctx context.Context) (pending int, total int, err error)
    List(ctx context.Context) ([]WalkIn, error)
}
```

Add `WalkIns WalkInsStore` to the `Storage` struct.

#### `WalkIn` model

```go
type WalkIn struct {
    ID          string     `json:"id"`
    UserID      string     `json:"user_id"`
    QueuedAt    time.Time  `json:"queued_at"`
    PromotedAt  *time.Time `json:"promoted_at"`
    PromotedBy  *string    `json:"promoted_by"`
    // joined fields for API responses
    Name        string     `json:"name"`
    Email       string     `json:"email"`
    // derived field for the dashboard list — live FIFO position among un-promoted rows.
    // Postgres ROW_NUMBER() returns bigint; either use int64 here or cast in SQL:
    // ROW_NUMBER() OVER (...)::int
    Position    int        `json:"position"`
}
```

#### `Enqueue`

`Enqueue` runs as a single transaction that performs three coupled writes plus a
position read. Pseudocode:

```go
func (s *WalkInsStore) Enqueue(ctx context.Context, userID string) (bool, int, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil { return false, 0, err }
    defer tx.Rollback()

    // 1. Short-circuit: user already accepted via normal review.
    var status sql.NullString
    err = tx.QueryRowContext(ctx,
        `SELECT status FROM applications WHERE user_id = $1`, userID).Scan(&status)
    if err != nil && !errors.Is(err, sql.ErrNoRows) {
        return false, 0, err
    }
    if status.Valid && status.String == "accepted" {
        return false, 0, tx.Commit()
    }

    // 2. Insert walk_ins row (no-op on conflict).
    res, err := tx.ExecContext(ctx,
        `INSERT INTO walk_ins (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        userID)
    if err != nil { return false, 0, err }
    affected, _ := res.RowsAffected()
    if affected == 0 {
        return false, 0, tx.Commit()  // re-scan, no email
    }

    // 3. Upsert applications → waitlisted (atomic, see Step 4 pattern).
    _, err = tx.ExecContext(ctx, `
        INSERT INTO applications (user_id, status, submitted_at, responses)
        VALUES ($1, 'waitlisted', NOW(), '{}')
        ON CONFLICT (user_id) DO UPDATE
        SET status = 'waitlisted',
            submitted_at = COALESCE(applications.submitted_at, EXCLUDED.submitted_at)
    `, userID)
    if err != nil { return false, 0, err }

    // 4. Compute FIFO position for the queued email.
    var position int
    err = tx.QueryRowContext(ctx, `
        SELECT pos FROM (
            SELECT user_id,
                   ROW_NUMBER() OVER (ORDER BY queued_at ASC, id ASC) AS pos
            FROM walk_ins
            WHERE promoted_at IS NULL
        ) ranked
        WHERE user_id = $1
    `, userID).Scan(&position)
    if err != nil { return false, 0, err }

    return true, position, tx.Commit()
}
```

Why a transaction: the three writes (walk_ins insert, applications upsert, position
read) must agree on a single snapshot. Without a transaction, a concurrent `PromoteNext`
could promote someone between our insert and our position read and give us a stale
position, or our applications upsert could land while our walk_ins insert was rolled
back.

**Status semantics (covered in decision 4b):** Walk-in scan flips status to
`waitlisted`, with `accepted` as the only short-circuit case. All other prior statuses
(`draft`, `submitted`, `rejected`, `waitlisted`) are overridden.

#### `PromoteNext`

This is the most complex method. It runs in a single transaction:

```
BEGIN
  SELECT id, user_id FROM walk_ins
  WHERE promoted_at IS NULL
  ORDER BY queued_at ASC
  LIMIT $count
  FOR UPDATE SKIP LOCKED;

  UPDATE walk_ins
  SET promoted_at = NOW(), promoted_by = $promotedBy
  WHERE id = ANY($selectedIDs);

  -- For each user_id: upsert application to accepted (see Step 4)

COMMIT
```

`FOR UPDATE SKIP LOCKED` prevents two concurrent promotion requests from selecting the
same rows. Returns `[]User` (with name and email populated via a JOIN) so the handler can
fire emails after commit without re-querying.

Because `Enqueue` already created `applications` rows with `status='waitlisted'` for
every queued user, the application status update inside `PromoteNext` can be a single
bulk statement instead of N atomic upserts:

```sql
UPDATE applications SET status='accepted' WHERE user_id = ANY($userIDs);
```

This is the happy path. If for any reason a row is missing (data drift, manual deletion),
fall back to the Step 4 atomic upsert. In practice the bulk UPDATE is what runs.

**Concurrency notes (deadlock analysis):**

- **Two concurrent `PromoteNext` calls:** `SKIP LOCKED` guarantees they select disjoint
  `walk_ins` rows. Because `walk_ins.user_id` is `UNIQUE`, the downstream `applications`
  updates also touch disjoint rows. No lock overlap, no deadlock possible.
- **`PromoteNext` + concurrent `Enqueue`:** `Enqueue` inserts a new row; `PromoteNext`
  locks existing rows. No conflict.
- **`PromoteNext` + concurrent `SetApplicationStatus` / hacker form submit on the same
  user:** Lock acquisition pattern is asymmetric (`PromoteNext` goes `walk_ins` →
  `applications`; the others only touch `applications`). No cycle is possible — one
  waits, neither deadlocks.
- **Defensive recommendation:** Inside `PromoteNext`, iterate the promoted users in a
  deterministic order (e.g. sort by `user_id`) when applying the application upsert.
  `SKIP LOCKED` already guarantees no overlap with another `PromoteNext`, but
  deterministic order is belt-and-braces in case the locking model changes later.
- **Tiebreaker for `queued_at`:** Two enqueues in the same microsecond create a tie.
  Use `ORDER BY queued_at ASC, id ASC` to keep FIFO ordering deterministic.

#### `QueueDepth`

```sql
SELECT
    COUNT(*) FILTER (WHERE promoted_at IS NULL) AS pending,
    COUNT(*)                                    AS total
FROM walk_ins;
```

#### `List`

```sql
SELECT
    w.id, w.user_id, w.queued_at, w.promoted_at, w.promoted_by,
    u.name, u.email,
    ROW_NUMBER() OVER (ORDER BY w.queued_at ASC, w.id ASC) AS position
FROM walk_ins w
JOIN users u ON u.id = w.user_id
WHERE w.promoted_at IS NULL
ORDER BY w.queued_at ASC, w.id ASC;
```

Returns only un-promoted entries for the dashboard view, with a live `position` field
computed at query time. Position 1 is the next person to be promoted.

---

### Step 4 — Application status upsert (defensive fallback for promotion)

> **Role of this step:** The happy path for promotion is the bulk
> `UPDATE applications SET status='accepted' WHERE user_id = ANY(...)` shown in Step 3's
> `PromoteNext`. This step describes the per-user atomic upsert that runs **only if a
> row is missing** (data drift, manual deletion) — it is a defensive fallback, not the
> primary path. In normal operation `Enqueue` guarantees rows exist by promotion time,
> so this fallback never fires.

The fallback lives inside the `PromoteNext` transaction, inlined as a helper called
per user when the bulk UPDATE affects 0 rows for a given `user_id`. It is not a new
public method on `ApplicationsStore` — it runs within the transaction connection
already open.

**Use a single atomic upsert, not UPDATE-then-INSERT.** A two-statement UPDATE→INSERT
has a TOCTOU race: a hacker hitting `GET /applications/me` between our UPDATE and INSERT
can lazy-create a draft row, causing our INSERT-ON-CONFLICT-DO-NOTHING to become a no-op
and leaving the user stuck at `status='draft'` instead of `accepted`.

```sql
INSERT INTO applications (user_id, status, submitted_at, responses)
VALUES ($userID, 'accepted', NOW(), '{}')
ON CONFLICT (user_id) DO UPDATE
SET status = 'accepted',
    submitted_at = COALESCE(applications.submitted_at, EXCLUDED.submitted_at);
```

The `COALESCE(applications.submitted_at, EXCLUDED.submitted_at)` handles all three cases
atomically:
- **No existing row:** INSERT runs, `submitted_at` set to NOW().
- **Existing draft (`submitted_at IS NULL`):** UPDATE runs, `COALESCE` picks NOW().
- **Existing submitted/accepted/rejected/waitlisted:** UPDATE runs, `COALESCE` preserves
  the original `submitted_at`.

One statement, atomic, no race window.

---

### Step 5 — `createScanHandler` changes (`cmd/api/scans.go`)

Four sub-changes to the existing handler:

#### 5a — Skip check-in prerequisite for walk-in scans

The current prerequisite block runs for any scan category that is not `check_in`. Add a
carve-out for `walk_in`:

```go
// Before (existing logic):
if scanType.Category != store.ScanCategoryCheckIn {
    // HasCheckIn check...
}

// After:
if scanType.Category != store.ScanCategoryCheckIn &&
   scanType.Category != store.ScanCategoryWalkIn {
    // HasCheckIn check...
}
```

#### 5b — Enqueue and email on walk-in scan

After scan type validation and before calling `store.Scans.Create`, add:

```go
if scanType.Category == store.ScanCategoryWalkIn {
    inserted, position, err := app.store.WalkIns.Enqueue(r.Context(), req.UserID)
    if err != nil {
        app.internalServerError(w, r, err)
        return
    }
    if inserted {
        // only email on first enqueue, not on re-scan or already-accepted short-circuit
        go func() {
            if err := app.mailer.SendWalkInQueuedEmail(scannedUser.Email, scannedUser.Name, position); err != nil {
                app.logger.Errorw("failed to send walk-in queued email", "error", err)
            }
        }()
    }
}
```

`Enqueue` returns `(inserted bool, position int, err error)`. `inserted=true` only on a
fresh queue entry; `false` for re-scans and for users already accepted. The scan record
(`store.Scans.Create`) is still written either way for the audit trail. `position` is the
user's FIFO position at enqueue time, surfaced in the email body.

Note: `scannedUser` requires a user lookup by `req.UserID`. Currently `createScanHandler`
does not look up the scanned user (validation is implicit via FK). A `store.Users.GetByID`
call is added here — only when the scan type is `walk_in`. This avoids regressing
performance for the common case (check-in, meal, swag scans).

**Race condition note:** `Enqueue` and `Scans.Create` are two separate transactions. If
`Enqueue` succeeds but `Scans.Create` fails transiently, the user is queued without an
audit scan record. On retry, `Enqueue` is idempotent (no second email) and `Scans.Create`
will retry cleanly. End state is consistent — this is an accepted edge case, not a bug.

**Goroutine shutdown note:** The `go func()` email sends are fire-and-forget. If the
process receives SIGTERM mid-send, in-flight emails may be lost silently. Acceptable for
v1 (walk-in flow is operator-driven and rare). Future iteration may want a worker queue
or graceful-shutdown WaitGroup.

#### 5c — Guard in `updateScanTypesHandler`

Extend the existing "at least one active check_in must exist" validation to also require
at least one active `walk_in` type:

```go
hasCheckIn := false
hasWalkIn  := false
for _, t := range payload.ScanTypes {
    if t.IsActive && t.Category == store.ScanCategoryCheckIn { hasCheckIn = true }
    if t.IsActive && t.Category == store.ScanCategoryWalkIn  { hasWalkIn  = true }
}
if !hasCheckIn {
    app.badRequestResponse(w, r, fmt.Errorf("at least one active check_in scan type is required"))
    return
}
if !hasWalkIn {
    app.badRequestResponse(w, r, fmt.Errorf("at least one active walk_in scan type is required"))
    return
}
```

#### 5d — Check-in scanner guard: require `accepted` status

**Problem this solves.** When the super admin promotes "the first 20 walk-ins" and the
admin starts checking them in at the main scanner, there's nothing in the existing scan
handler that stops person #25 (still `waitlisted`) from walking up to the check-in
scanner and being checked in. The volunteer at the door has no signal that #25 hasn't
been promoted yet.

**Guard.** When `scanType.Category == ScanCategoryCheckIn`, look up the user's
application status and require it to be `accepted`:

```go
if scanType.Category == store.ScanCategoryCheckIn {
    status, err := app.store.Applications.GetStatusByUserID(r.Context(), req.UserID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.forbiddenResponse(w, r, fmt.Errorf("user has no application"))
            return
        }
        app.internalServerError(w, r, err)
        return
    }
    if status != store.StatusAccepted {
        app.forbiddenResponse(w, r,
            fmt.Errorf("user is not accepted (status: %s)", status))
        return
    }
}
```

The volunteer sees a clean 403 with a meaningful message — "user is not accepted
(status: waitlisted)" — and can tell the person "you haven't been promoted yet, please
wait."

**Why this is broader than just the walk-in flow.** This guard hardens check-in across
the board:
- Rejected applicant with an old QR → blocked.
- Waitlisted person arrives at check-in before being promoted → blocked.
- Draft applicant who never submitted → blocked.
- Accepted person (normal review or promoted walk-in) → allowed.

The invariant "only accepted people are checked in" is now enforced by code rather than
relying on the volunteer reading position numbers correctly.

**New store method required.** Add `GetStatusByUserID(ctx, userID) (ApplicationStatus, error)`
on `ApplicationsStore`. Returns `ErrNotFound` when no row exists. The query is a single
indexed lookup — cheap.

```go
// ApplicationsStore
func (s *ApplicationsStore) GetStatusByUserID(ctx context.Context, userID string) (ApplicationStatus, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    var status ApplicationStatus
    err := s.db.QueryRowContext(ctx,
        `SELECT status FROM applications WHERE user_id = $1`, userID).Scan(&status)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return "", ErrNotFound
        }
        return "", err
    }
    return status, nil
}
```

**Operator override considered, deferred.** A future iteration could add an "override"
flag (e.g. `POST /v1/admin/scans { "user_id": "...", "scan_type": "check_in", "override": true }`)
that lets a super admin bypass the guard for genuine emergencies. Not in scope for v1 —
the simpler rule is easier to reason about and harder to misuse.

---

### Step 6 — New handlers (`cmd/api/walkins.go`)

New file with two handlers, both super-admin only.

#### `GET /v1/superadmin/walk-ins` — `getWalkInsHandler`

Calls `store.WalkIns.QueueDepth()` and `store.WalkIns.List()`.

Response envelope:
```json
{
  "data": {
    "pending": 14,
    "total":   23,
    "queue": [
      {
        "position":  1,
        "user_id":   "abc-123",
        "name":      "Jane Doe",
        "email":     "jane@example.com",
        "queued_at": "2026-06-07T10:32:00Z"
      }
    ]
  }
}
```

`queue` contains only un-promoted entries, ordered by `queued_at ASC` (arrival order).
No pagination — walk-in queues are bounded by physical venue capacity and will not grow
large enough to need cursor pagination.

#### `POST /v1/superadmin/walk-ins/promote` — `promoteWalkInsHandler`

Request body:
```json
{ "count": 5 }
```

Validation: `count` must be `>= 1`. There is no upper bound enforced in the handler —
if the super admin requests more than are pending, the transaction promotes only what
is available and returns the actual promoted count.

Flow:
1. Parse and validate `count`.
2. Get the authenticated super admin user via `getUserFromContext`.
3. Call `store.WalkIns.PromoteNext(ctx, count, adminUser.ID)` — single transaction
   covering queue stamp + bulk application status update to `accepted`.
4. After commit, fire `SendWalkInAcceptedEmail` for each promoted user in a goroutine
   per user. Errors are logged and do not fail the HTTP response.
5. Return 200 with the promoted user list.

Response envelope:
```json
{
  "data": {
    "promoted_count": 5,
    "promoted": [
      { "user_id": "...", "name": "...", "email": "..." }
    ]
  }
}
```

**Partial failure policy:** If the DB transaction succeeds but an email send fails,
we log the error and continue. The promotion is committed regardless. This is acceptable
because re-sending an email is cheaper than rolling back a promotion — and an operator
can resend manually. A retry queue is out of scope.

---

### Step 7 — Router wiring (`cmd/api/api.go`)

Inside the existing `r.Group` protected by `RequireRoleMiddleware(store.RoleSuperAdmin)`,
add alongside the existing `r.Route("/settings", ...)`:

```go
r.Route("/walk-ins", func(r chi.Router) {
    r.Get("/", app.getWalkInsHandler)
    r.Post("/promote", app.promoteWalkInsHandler)
})
```

---

### Step 8 — Mailer

#### Interface extension (`internal/mailer/mailer.go`)

```go
type Client interface {
    SendQREmail(toEmail, toName, userID string) error
    SendWalkInQueuedEmail(toEmail, toName string, position int) error  // new
    SendWalkInAcceptedEmail(toEmail, toName, userID string) error      // new
}
```

`SendWalkInAcceptedEmail` takes `userID` for QR code generation, same as `SendQREmail`.
`SendWalkInQueuedEmail` takes `position` so the template can render the user's FIFO
position at enqueue time.

#### SendGrid implementation (`internal/mailer/sendgrid.go`)

`SendWalkInQueuedEmail`:
- Subject: `"You're #N in the HackUTD walk-in queue"` (templated with position; final
  copy from ops)
- Template: `walk_in_queued.html`
- Template data: `struct{ Name string; Position int }`
- No attachment

`SendWalkInAcceptedEmail`:
- Subject: `"You're in — HackUTD Walk-In Acceptance"` (placeholder until ops confirms)
- Template: `walk_in_accepted.html`
- Template data: `struct{ Name string }` (QR code attached as PNG, same logic as `SendQREmail`)
- QR attachment: generated from `userID`, same `generateQRCode(userID)` helper

#### Templates

**`internal/mailer/template/walk_in_queued.html`**

Scaffold structure (copy TBD from ops):
```
Subject: You're #{{.Position}} in the HackUTD walk-in queue
Body:
  Hi {{.Name}},
  You've been added to the HackUTD walk-in queue at position #{{.Position}}.
  Your application status is now waitlisted. We'll email you with a QR code
  if a spot opens up. Hang tight!
  — The HackUTD Team
```

**`internal/mailer/template/walk_in_accepted.html`**

Scaffold structure (copy TBD from ops):
```
Subject: You're in — HackUTD Walk-In Acceptance
Body:
  Hi {{.Name}},
  Great news — you've been accepted as a walk-in to HackUTD!
  Your QR code is attached. Bring it to check in at the event.
  — The HackUTD Team
[QR code attachment]
```

#### Mock (`internal/mailer/mock_mailer.go`)

Add mock implementations following the existing `MockMailer` pattern:

```go
func (m *MockMailer) SendWalkInQueuedEmail(toEmail, toName string, position int) error {
    args := m.Called(toEmail, toName, position)
    return args.Error(0)
}

func (m *MockMailer) SendWalkInAcceptedEmail(toEmail, toName, userID string) error {
    args := m.Called(toEmail, toName, userID)
    return args.Error(0)
}
```

---

### Step 9 — Mock store

Add mock implementations in `internal/store/mock_store.go` for all four `WalkInsStore` methods:

```go
type MockWalkInsStore struct {
    mock.Mock
}

func (m *MockWalkInsStore) Enqueue(ctx context.Context, userID string) (bool, int, error) {
    args := m.Called(userID)
    return args.Bool(0), args.Int(1), args.Error(2)
}

func (m *MockWalkInsStore) PromoteNext(ctx context.Context, count int, promotedBy string) ([]store.User, error) {
    args := m.Called(count, promotedBy)
    return args.Get(0).([]store.User), args.Error(1)
}

func (m *MockWalkInsStore) QueueDepth(ctx context.Context) (int, int, error) {
    args := m.Called()
    return args.Int(0), args.Int(1), args.Error(2)
}

func (m *MockWalkInsStore) List(ctx context.Context) ([]store.WalkIn, error) {
    args := m.Called()
    return args.Get(0).([]store.WalkIn), args.Error(1)
}
```

Wire `MockWalkIns MockWalkInsStore` into `MockStore` and set `store.WalkIns = &mockStore.MockWalkIns`
in `newTestApplication`.

---

### Step 10 — Tests

Handler tests follow the `newTestApplication` / `MockStore` / `setUserContext` pattern.
Store tests for `PromoteNext` need a real DB connection — check whether the existing
test infra already provides one (testcontainers, dedicated test DB, etc.) before
implementing.

#### `internal/store/walkins_test.go` — new file (store-level)

The transaction logic in `PromoteNext` is the highest-risk code in this feature and
cannot be meaningfully tested with mocks. Required cases:

| Case | Setup | Expected |
|---|---|---|
| FIFO ordering | 5 users enqueued at staggered times | `PromoteNext(3)` returns users in `queued_at` order |
| Enqueue sets status to waitlisted (no prior row) | User has no `applications` row | After `Enqueue`: row exists with `status='waitlisted'`, `submitted_at=NOW`, `responses='{}'` |
| Enqueue flips draft to waitlisted | User has `status='draft'`, `submitted_at=NULL` | After `Enqueue`: `status='waitlisted'`, `submitted_at` set to NOW |
| Enqueue flips rejected to waitlisted | User has `status='rejected'`, `submitted_at='2026-05-01'` | After `Enqueue`: `status='waitlisted'`, `submitted_at` preserved |
| Enqueue short-circuits already-accepted user | User has `status='accepted'` | Returns `(false, 0, nil)`; no `walk_ins` row created; status unchanged |
| Enqueue returns FIFO position | 6 users enqueued, then 7th enqueues | 7th `Enqueue` returns `(true, 7, nil)` |
| Enqueue is idempotent on re-scan | `Enqueue` twice for same user | Second returns `(false, 0, nil)`; only one row exists |
| Promotion flips waitlisted to accepted | User has `status='waitlisted'` (from prior `Enqueue`) | After `PromoteNext`: `status='accepted'`, `submitted_at` preserved |
| Promotion preserves submitted_at | User has `submitted_at='2026-05-01'` | After `PromoteNext`: `submitted_at` unchanged |
| Concurrent promotion doesn't double-promote | Two parallel `PromoteNext(5)` calls on a queue of 5 | Combined return is exactly 5 distinct users; no row promoted twice (validates `FOR UPDATE SKIP LOCKED`) |
| List returns live positions | 4 users enqueued | `List` returns rows with `position` = 1, 2, 3, 4 |
| List positions update after promotion | Promote first user, then list | Remaining users now have `position` = 1, 2, 3 |

#### Handler tests

##### `cmd/api/scans_test.go` — new cases

| Test name | Setup | Expected |
|---|---|---|
| `walk-in scan enqueues user, sets waitlisted, fires queued email with position` | Mock `Enqueue` returns `(true, 7, nil)`, mock `Scans.Create` succeeds | 201, `SendWalkInQueuedEmail` called once with `position=7` |
| `walk-in re-scan is no-op, no second email` | Mock `Enqueue` returns `(false, 0, nil)` (conflict) | 201, `SendWalkInQueuedEmail` NOT called |
| `walk-in scan of already-accepted user is no-op` | Mock `Enqueue` returns `(false, 0, nil)` (short-circuit) | 201, `SendWalkInQueuedEmail` NOT called |
| `walk-in scan does not require prior check-in` | No `HasCheckIn` mock set up | 201 (no 403) |
| `non-walk-in scan still requires check-in` | Mock `HasCheckIn` returns `false` | 403 |
| `walk-in scan with unknown user returns 404` | Mock `Scans.Create` returns `ErrNotFound` | 404 |
| `check-in scan of accepted user succeeds` | Mock `GetStatusByUserID` returns `StatusAccepted` | 201 |
| `check-in scan of waitlisted user returns 403` | Mock `GetStatusByUserID` returns `StatusWaitlisted` | 403, message includes "not accepted (status: waitlisted)" |
| `check-in scan of rejected user returns 403` | Mock `GetStatusByUserID` returns `StatusRejected` | 403 |
| `check-in scan of user with no application returns 403` | Mock `GetStatusByUserID` returns `ErrNotFound` | 403, message "user has no application" |

##### `cmd/api/walkins_test.go` — new file

**`TestGetWalkIns`**

| Test name | Setup | Expected |
|---|---|---|
| `returns queue depth and pending list` | Mock `QueueDepth` → `(3, 5)`, mock `List` → 3 users | 200, `pending=3`, `total=5`, 3 items in queue |
| `empty queue returns zero counts` | Mock `QueueDepth` → `(0, 0)`, mock `List` → `[]` | 200, `pending=0`, `queue=[]` |
| `non-super-admin gets 403` | `setUserContext` with admin role | 403 |
| `store error returns 500` | Mock `QueueDepth` returns error | 500 |

**`TestPromoteWalkIns`**

| Test name | Setup | Expected |
|---|---|---|
| `promotes N users and fires acceptance emails` | Mock `PromoteNext` → 3 users | 200, `promoted_count=3`, `SendWalkInAcceptedEmail` called 3 times |
| `count=0 returns 400` | No mocks needed | 400 |
| `count exceeds pending, promotes only available` | Mock `PromoteNext` → 1 user (requested 5) | 200, `promoted_count=1` |
| `non-super-admin gets 403` | `setUserContext` with admin role | 403 |
| `store error returns 500` | Mock `PromoteNext` returns error | 500 |

---

## File Change Summary

| File | Type | Change |
|---|---|---|
| `cmd/migrate/migrations/000015_add_walk_ins.up.sql` | New | `walk_ins` table + FIFO index |
| `cmd/migrate/migrations/000015_add_walk_ins.down.sql` | New | `DROP TABLE walk_ins` |
| `cmd/migrate/migrations/000016_add_walkin_scan_type.up.sql` | New | Upsert `walk_in` into `scan_types` setting |
| `cmd/migrate/migrations/000016_add_walkin_scan_type.down.sql` | New | Remove `walk_in` from `scan_types` setting |
| `internal/store/scans.go` | Edit | Add `ScanCategoryWalkIn` constant, extend validate tag |
| `internal/store/walkins.go` | New | `WalkInsStore` — `Enqueue`, `PromoteNext`, `QueueDepth`, `List` |
| `internal/store/storage.go` | Edit | Add `WalkIns WalkInsStore` to `Storage` struct; add `GetStatusByUserID` to `ApplicationsStore` interface |
| `internal/store/applications.go` | Edit | Implement `GetStatusByUserID` for the check-in guard |
| `internal/store/mock_store.go` | Edit | Mock `WalkInsStore` methods; mock `Applications.GetStatusByUserID`; wire into `MockStore` |
| `internal/mailer/mailer.go` | Edit | Add `SendWalkInQueuedEmail`, `SendWalkInAcceptedEmail` to interface |
| `internal/mailer/sendgrid.go` | Edit | Implement both new email methods |
| `internal/mailer/mock_mailer.go` | Edit | Mock both new email methods |
| `internal/mailer/template/walk_in_queued.html` | New | Queued confirmation email template |
| `internal/mailer/template/walk_in_accepted.html` | New | Acceptance + QR email template |
| `cmd/api/scans.go` | Edit | Walk-in branch in `createScanHandler`, check-in `accepted`-status guard (Step 5d), guard in `updateScanTypesHandler` |
| `cmd/api/walkins.go` | New | `getWalkInsHandler`, `promoteWalkInsHandler` |
| `cmd/api/api.go` | Edit | Wire `GET /superadmin/walk-ins`, `POST /superadmin/walk-ins/promote` |
| `cmd/api/scans_test.go` | Edit | Walk-in scan test cases |
| `cmd/api/walkins_test.go` | New | Handler tests for both walk-in endpoints |
| `internal/store/walkins_test.go` | New | Store tests for `PromoteNext` transaction logic |

---

## Frontend Implementation

> **Status:** Backend complete. Frontend work below is the remaining scope.
> **Tech stack:** React 19 + TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, React Hook Form + Zod.

---

### FE-1 — Update scan type definitions (`pages/admin/scans/`)

Three files need touching before the walk-in category renders correctly in the existing
scan management UI.

#### `pages/admin/scans/types.ts`

Add `"walk_in"` to the `ScanTypeCategory` union:

```typescript
export type ScanTypeCategory = "check_in" | "meal" | "swag" | "other" | "walk_in";
```

#### `pages/admin/scans/utils.ts`

Two sub-changes:

**a) Add walk_in to the category lookup tables.**
The file already has `categoryIcons`, `categoryColors`, and `categoryOptions` keyed by
`ScanTypeCategory`. Add a `walk_in` entry to each:

```typescript
categoryIcons = {
  // ...existing...
  walk_in: UserPlus,  // or a suitable Lucide icon (e.g. DoorOpen, LogIn)
}

categoryColors = {
  // ...existing...
  walk_in: "bg-violet-100 text-violet-700",
}

categoryOptions = [
  // ...existing...
  { label: "Walk-In", value: "walk_in" },
]
```

**b) Update the scan-type validation.**
The current validator enforces exactly one `check_in` type. The backend now also requires at
least one active `walk_in`. Match the frontend validation:

```typescript
// Before
const checkInCount = scanTypes.filter(t => t.category === "check_in").length;
if (checkInCount !== 1) return "Exactly one scan type must have the check_in category";

// After
const hasCheckIn = scanTypes.some(t => t.is_active && t.category === "check_in");
const hasWalkIn  = scanTypes.some(t => t.is_active && t.category === "walk_in");
if (!hasCheckIn) return "At least one active check_in scan type is required";
if (!hasWalkIn)  return "At least one active walk_in scan type is required";
```

#### `pages/admin/scans/components/ScanTypesTable.tsx`

No structural changes required. The component already uses `categoryIcons` and
`categoryColors` by key — adding the keys in utils.ts is enough. The fallback
`?? UserCheck` on line 431 catches any unknown category anyway.

---

### FE-2 — ScannerDialog (`pages/admin/scans/components/ScannerDialog.tsx`)

**No code changes required.**

The ScannerDialog is category-agnostic — it uses `activeScanType.display_name` as
the title and passes `activeScanType.name` to `performScan()`. Walk-in will appear
in the scan type selector exactly like meal or swag.

The backend handles all walk-in-specific logic (enqueue, email, check-in guard).
The scanner just POSTs `{ user_id, scan_type }` and shows the result. A 403 "user is
not accepted" (from the check-in guard) and a 201 (from a walk-in scan) both render
through the existing success/error path with no frontend changes.

**One thing to verify at implementation time:** confirm the scan type selector (wherever
`activeScanType` is set) pulls from `GET /v1/admin/scans/types`. Walk-in will appear
automatically once migration 000016 runs. If the selector filters by category, ensure
`walk_in` is not accidentally excluded.

---

### FE-3 — Walk-In Queue page (`pages/superadmin/walk-in-queue/`)

A dedicated super-admin page for viewing the live queue and promoting walk-ins.
Co-located per the project convention.

#### File structure

```
pages/superadmin/walk-in-queue/
  ├── index.ts              (barrel export)
  ├── WalkInQueuePage.tsx   (page component)
  ├── api.ts                (getWalkInQueue, promoteWalkIns)
  ├── types.ts              (WalkIn, WalkInsResponse, PromoteResponse)
  └── components/
      ├── WalkInQueueTable.tsx   (queue depth stats + ranked list)
      └── PromoteDialog.tsx      (count input + confirm → POST promote)
```

#### `types.ts`

```typescript
export interface WalkIn {
  id: string;
  user_id: string;
  email: string;
  queued_at: string;
  position: number;
}

export interface WalkInsResponse {
  pending: number;
  total: number;
  queue: WalkIn[];
}

export interface PromoteResponse {
  promoted_count: number;
  promoted: { id: string; email: string }[];
}
```

#### `api.ts`

```typescript
import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/shared/lib/api";
import type { WalkInsResponse, PromoteResponse } from "./types";

export function getWalkInQueue(signal?: AbortSignal): Promise<ApiResponse<WalkInsResponse>> {
  return getRequest<WalkInsResponse>("/v1/superadmin/walk-ins", "fetch walk-in queue", signal);
}

export function promoteWalkIns(count: number): Promise<ApiResponse<PromoteResponse>> {
  return postRequest<PromoteResponse>("/v1/superadmin/walk-ins/promote", { count }, "promote walk-ins");
}
```

#### `WalkInQueuePage.tsx` — structure

- On mount, calls `getWalkInQueue()` and stores result in local state (no Zustand store
  needed — this is a live operational view that's always fresh).
- Shows a stats bar: `{pending} waiting · {total} total walk-ins`.
- Renders `<WalkInQueueTable queue={queue} />` below the stats.
- Renders `<PromoteDialog onSuccess={refetch} />` as a button that opens a dialog.
- Auto-refreshes the queue every 30 seconds while the page is open (setInterval with
  cleanup in useEffect), or after a successful promotion.

#### `WalkInQueueTable.tsx`

| Col | Value |
|---|---|
| # | `position` |
| Email | `email` |
| Arrived | `queued_at` formatted as local time |

No pagination needed — the queue is bounded by venue capacity and will not grow large.
Empty state: "No walk-ins in queue."

#### `PromoteDialog.tsx`

- Button label: **"Promote next N walk-ins"**
- On click, opens a shadcn/ui `<Dialog>`.
- Dialog body: a numeric input (min 1, no max enforced) labelled "Number to promote".
  Pre-populated with `Math.min(pending, 20)` as a sensible default.
- Confirm button: "Promote & send emails" — calls `promoteWalkIns(count)`.
- Loading state on the confirm button while the request is in flight.
- On success: toast `"Promoted {n} walk-ins and sent acceptance emails"`, close dialog,
  call `onSuccess()` to trigger queue refresh.
- On error: toast the error message, keep dialog open so the operator can retry.

```typescript
// Zod schema for the form
const schema = z.object({ count: z.coerce.number().int().min(1) });
```

React Hook Form + Zod for the input; no need for a separate page-level Zustand store.

---

### FE-4 — Router wiring (`routes.tsx`)

Inside the super-admin route group (where `/admin/sa/*` routes live), add:

```tsx
<Route
  path="walk-in-queue"
  element={
    <RequireSuperAdmin>
      <WalkInQueuePage />
    </RequireSuperAdmin>
  }
/>
```

Full path: `/admin/sa/walk-in-queue`.

---

### FE-5 — Sidebar nav (`pages/admin/_shared/AppSidebar.tsx`)

In the Super Admin section (currently has Reviews, User Management, Application), add:

```tsx
{
  title: "Walk-In Queue",
  url: "/admin/sa/walk-in-queue",
  icon: DoorOpen,   // Lucide icon; matches the walk_in category icon chosen in FE-1
}
```

The section is already conditionally rendered for `user?.role === "super_admin"` — no
additional guard needed.

---

### Frontend File Change Summary

| File | Type | Change |
|---|---|---|
| `pages/admin/scans/types.ts` | Edit | Add `"walk_in"` to `ScanTypeCategory` |
| `pages/admin/scans/utils.ts` | Edit | Add walk_in to icon/color/options tables; update validation |
| `pages/admin/scans/components/ScanTypesTable.tsx` | No change | Picks up walk_in from utils automatically |
| `pages/admin/scans/components/ScannerDialog.tsx` | No change | Category-agnostic; walk_in works automatically |
| `pages/superadmin/walk-in-queue/types.ts` | New | `WalkIn`, `WalkInsResponse`, `PromoteResponse` |
| `pages/superadmin/walk-in-queue/api.ts` | New | `getWalkInQueue`, `promoteWalkIns` |
| `pages/superadmin/walk-in-queue/WalkInQueuePage.tsx` | New | Page component with auto-refresh |
| `pages/superadmin/walk-in-queue/components/WalkInQueueTable.tsx` | New | Ranked queue table |
| `pages/superadmin/walk-in-queue/components/PromoteDialog.tsx` | New | Count input + confirm dialog |
| `pages/superadmin/walk-in-queue/index.ts` | New | Barrel export |
| `routes.tsx` | Edit | Add `/admin/sa/walk-in-queue` route |
| `pages/admin/_shared/AppSidebar.tsx` | Edit | Add Walk-In Queue nav item to super admin section |

---

### Frontend Open Items

| # | Item | Blocking |
|---|---|---|
| FE-1 | Choose the Lucide icon for walk_in category (suggestion: `DoorOpen` or `LogIn`) | FE-1 utils + FE-5 sidebar |
| FE-2 | Confirm auto-refresh interval is acceptable (30s) or switch to manual refresh button | FE-3 page |
| FE-3 | Confirm PromoteDialog default count (`Math.min(pending, 20)`) or a fixed default | FE-3 PromoteDialog |

---

## Open Items Before Implementation

| # | Item | Owner | Blocking |
|---|---|---|---|
| 1 | Email subject + body copy for `walk_in_queued` | Ops/marketing | Mailer templates (Step 8) |
| 2 | Email subject + body copy for `walk_in_accepted` | Ops/marketing | Mailer templates (Step 8) |
| 3 | Confirm partial email failure policy (log + continue) | Tech lead | Step 6 handler design |
| 4 | Audit `applications.responses` read paths for empty-object tolerance | Backend dev | Step 3 Enqueue and Step 4 PromoteNext stubs |
| 4b | Confirm no legitimate caller relies on check-in scans of non-accepted users (Step 5d guard) | Backend dev / product | Step 5d |
| 5 | Confirm `app.logger` is the actual field name on the application struct | Backend dev | Trivial — verify before writing handler code |
| 6 | Confirm UUID generation convention (`gen_random_uuid` vs `uuid_generate_v4`) | Backend dev | Migration 16 |

Item 3 has a recommended default (log + continue) and can proceed on that default
if sign-off is not received before work begins. Items 4–6 are quick verification
checks, not external blockers.

---

## Implementation Order

Given dependencies, the recommended execution order is:

```
Step 1 (constants)
  → Step 2 (migrations)
    → Step 3 (store — contains both Enqueue stub logic and PromoteNext bulk update)
      → Step 4 (defensive fallback upsert — inlined in Step 3 PromoteNext)
      → Step 9 (mock store)
        → Step 5 (scan handler changes, including 5d check-in guard)
        → Step 6 (new walk-ins handlers)
          → Step 7 (router wiring)
  → Step 8 (mailer — can run in parallel with Steps 3–7 once templates are unblocked)
  → Step 10 (tests — after all handler/store work is complete)
```

Steps 1, 2, and 8 can be done independently and in parallel with the store/handler work.
