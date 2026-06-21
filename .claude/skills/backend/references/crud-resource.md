# CRUD Resource Pattern

Foundational pattern for an admin-managed entity with list/create/update/delete. Use this for resources where admins are the only writers and any signed-in admin (or super admin) sees the same view. Examples: schedule, sponsors.

If you also need cursor pagination/filtering, layer in `list-pagination.md`. If users own their own copy of the resource, use `self-resource.md` instead.

## When to Use

The user is asking for "manage X" where X has:
- A flat collection (no per-user scoping)
- Admin-only or super-admin-only writes
- Standard CRUD shape (list, create, update, delete) — possibly plus a get-by-id

Working example: **Schedule** (`internal/store/schedule.go`, `cmd/api/schedule.go`).

## 1. Migration

`cmd/migrate/migrations/000NNN_add_<resource>.up.sql` (check the highest existing number and increment).

```sql
CREATE TABLE IF NOT EXISTS <resource> (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- ... domain columns ...
    tags TEXT[] NOT NULL DEFAULT '{}',                  -- TEXT[] for arrays
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_<resource>_updated_at
BEFORE UPDATE ON <resource>
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_<resource>_<col> ON <resource>(<col>);  -- on the column you'll order/filter by
```

Down migration drops index, trigger, table (in that order):

```sql
DROP INDEX IF EXISTS idx_<resource>_<col>;
DROP TRIGGER IF EXISTS trg_<resource>_updated_at ON <resource>;
DROP TABLE IF EXISTS <resource>;
```

Conventions: UUID PKs, `TIMESTAMPTZ`, `TEXT[]` for string arrays, `JSONB` for structured data, `NOT NULL DEFAULT` for non-required fields.

## 2. Store (`internal/store/<resource>.go`)

### Model

```go
type Sponsor struct {
    ID           string    `json:"id"`
    Name         string    `json:"name"`
    Tier         string    `json:"tier"`
    WebsiteURL   string    `json:"website_url"`
    Description  string    `json:"description"`
    DisplayOrder int       `json:"display_order"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

type SponsorsStore struct {
    db *sql.DB
}
```

JSON tags: snake_case. Nullable fields: `*string` / `*int`. ID: always `string` (UUID rendered as text). For `TEXT[]` columns use `store.StringArray` (defined in `schedule.go`) — it implements `sql.Scanner` and `driver.Valuer`.

### List

`defer rows.Close()`, nil-safe slice, check `rows.Err()`.

```go
func (s *SponsorsStore) List(ctx context.Context) ([]Sponsor, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    query := `
        SELECT id, name, tier, website_url, description, display_order, created_at, updated_at
        FROM sponsors
        ORDER BY display_order ASC
    `

    rows, err := s.db.QueryContext(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var sponsors []Sponsor
    for rows.Next() {
        var sp Sponsor
        if err := rows.Scan(/* fields in same order as SELECT */); err != nil {
            return nil, err
        }
        sponsors = append(sponsors, sp)
    }
    if sponsors == nil {
        sponsors = []Sponsor{}        // avoid `null` in JSON when empty
    }
    return sponsors, rows.Err()
}
```

### GetByID

```go
func (s *SponsorsStore) GetByID(ctx context.Context, id string) (*Sponsor, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    var sp Sponsor
    err := s.db.QueryRowContext(ctx, `SELECT ... FROM sponsors WHERE id = $1`, id).Scan(/* ... */)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrNotFound
        }
        return nil, err
    }
    return &sp, nil
}
```

### Create

`INSERT ... RETURNING id, created_at, updated_at`. Mutate the input pointer:

```go
func (s *SponsorsStore) Create(ctx context.Context, sp *Sponsor) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    return s.db.QueryRowContext(ctx, `
        INSERT INTO sponsors (name, tier, website_url, description, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
    `, sp.Name, sp.Tier, sp.WebsiteURL, sp.Description, sp.DisplayOrder,
    ).Scan(&sp.ID, &sp.CreatedAt, &sp.UpdatedAt)
}
```

If you have a unique constraint that may collide, detect it and return `ErrConflict` — either via Postgres error code `23505` (`*pgconn.PgError`, see `scans.go`) or `strings.Contains(err.Error(), "<constraint_name>")` (see `applications.go`).

### Update

`UPDATE ... RETURNING updated_at`. `sql.ErrNoRows` → `ErrNotFound`:

```go
func (s *SponsorsStore) Update(ctx context.Context, sp *Sponsor) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    err := s.db.QueryRowContext(ctx, `
        UPDATE sponsors
        SET name = $1, tier = $2, website_url = $3, description = $4, display_order = $5
        WHERE id = $6
        RETURNING updated_at
    `, sp.Name, sp.Tier, sp.WebsiteURL, sp.Description, sp.DisplayOrder, sp.ID,
    ).Scan(&sp.UpdatedAt)

    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return ErrNotFound
        }
        return err
    }
    return nil
}
```

### Delete

`ExecContext` + `RowsAffected() == 0` → `ErrNotFound`:

```go
func (s *SponsorsStore) Delete(ctx context.Context, id string) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    result, err := s.db.ExecContext(ctx, `DELETE FROM sponsors WHERE id = $1`, id)
    if err != nil {
        return err
    }
    rows, err := result.RowsAffected()
    if err != nil {
        return err
    }
    if rows == 0 {
        return ErrNotFound
    }
    return nil
}
```

## 3. Interface & Wiring (`internal/store/storage.go`)

Add the interface to `Storage`, wire in `NewStorage()`:

```go
Sponsors interface {
    List(ctx context.Context) ([]Sponsor, error)
    GetByID(ctx context.Context, id string) (*Sponsor, error)
    Create(ctx context.Context, sp *Sponsor) error
    Update(ctx context.Context, sp *Sponsor) error
    Delete(ctx context.Context, id string) error
}
```

```go
return Storage{
    // ...
    Sponsors: &SponsorsStore{db: db},
}
```

## 4. Mock (`internal/store/mock_store.go`)

```go
type MockSponsorsStore struct{ mock.Mock }

func (m *MockSponsorsStore) List(ctx context.Context) ([]Sponsor, error) {
    args := m.Called()
    if args.Get(0) == nil { return nil, args.Error(1) }
    return args.Get(0).([]Sponsor), args.Error(1)
}
// ... GetByID, Create, Update, Delete ...
```

`m.Called()` receives all params **except ctx**. Nil-check `args.Get(0)` before type-asserting pointers/slices. Add to `NewMockStore()`.

## 5. Handlers (`cmd/api/<resource>.go`)

### Payload + Response Structs

```go
type SponsorPayload struct {
    Name         string `json:"name" validate:"required,min=1,max=100"`
    Tier         string `json:"tier" validate:"required,min=1,max=50"`
    WebsiteURL   string `json:"website_url" validate:"omitempty,url"`
    Description  string `json:"description"`
    DisplayOrder int    `json:"display_order" validate:"min=0"`
}

type SponsorListResponse struct {
    Sponsors []store.Sponsor `json:"sponsors"`
}
```

Naming: payloads `<Verb><Resource>Payload` or shared `<Resource>Payload` (re-use for create + update). Responses: `<Resource>ListResponse`, `<Resource>Response`. Use `validate` tags.

Tip: when the response struct has the same shape as the payload, you can type-convert: `SponsorListResponse(req)` (see `scans.go:266`).

### Handlers

```go
//  @Summary      List sponsors (Admin)
//  @Description  Returns all sponsors ordered by display order
//  @Tags         admin/sponsors
//  @Produce      json
//  @Success      200  {object}  SponsorListResponse
//  @Failure      401  {object}  object{error=string}
//  @Failure      403  {object}  object{error=string}
//  @Failure      500  {object}  object{error=string}
//  @Security     CookieAuth
//  @Router       /admin/sponsors [get]
func (app *application) listSponsorsHandler(w http.ResponseWriter, r *http.Request) {
    sponsors, err := app.store.Sponsors.List(r.Context())
    if err != nil {
        app.internalServerError(w, r, err)
        return
    }
    if err := app.jsonResponse(w, http.StatusOK, SponsorListResponse{Sponsors: sponsors}); err != nil {
        app.internalServerError(w, r, err)
    }
}
```

Create / Update / Delete follow the standard handler flow — validate URL param, parse body, validate struct, call store, map errors, respond. See `cmd/api/sponsors.go` and `cmd/api/schedule.go` for the complete pattern.

For DELETE: `w.WriteHeader(http.StatusNoContent)` — no body.

## 6. Routes (`cmd/api/api.go`)

Add inside the matching role block in `mount()`:

```go
r.Group(func(r chi.Router) {
    r.Use(app.RequireRoleMiddleware(store.RoleAdmin))   // or RoleSuperAdmin

    r.Route("/admin", func(r chi.Router) {
        r.Route("/sponsors", func(r chi.Router) {
            r.Get("/", app.listSponsorsHandler)
            r.Post("/", app.createSponsorHandler)
            r.Get("/{sponsorID}", app.getSponsorHandler)
            r.Put("/{sponsorID}", app.updateSponsorHandler)
            r.Delete("/{sponsorID}", app.deleteSponsorHandler)
        })
    })
})
```

If a sub-group needs feature-flag enforcement, wrap with a settings-gated middleware (see `settings-pattern.md`):

```go
r.Group(func(r chi.Router) {
    r.Use(app.AdminScheduleEditPermissionMiddleware)
    r.Post("/", app.createScheduleHandler)
    r.Put("/{scheduleID}", app.updateScheduleHandler)
    r.Delete("/{scheduleID}", app.deleteScheduleHandler)
})
```

## 7. Tests

See `testing.md` for utilities. CRUD coverage checklist:

| Handler | Cases |
|---------|-------|
| List | 200 with items, 200 empty, (optionally) 500 store error |
| GetByID | 200 success, 404 not found, 400 missing ID |
| Create | 201 success, 400 validation failure |
| Update | 200 success, 404 not found, 400 validation |
| Delete | 204 success, 404 not found |

Standard form (no URL params):

```go
rr := executeRequest(req, http.HandlerFunc(app.listSponsorsHandler))
checkResponseCode(t, http.StatusOK, rr.Code)
var body struct { Data SponsorListResponse `json:"data"` }
require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
```

For URL-param handlers: see `testing.md` "URL parameters" section (mini chi router OR inject `chi.NewRouteContext()`).

## Stats Sub-Pattern (aggregation endpoint)

For a read-only aggregate counts endpoint (e.g., `getApplicationStatsHandler`):

### Store

Single SELECT with `COUNT(*) FILTER (WHERE ...)`:

```go
func (s *ApplicationsStore) GetStats(ctx context.Context) (*ApplicationStats, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    query := `
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
            COUNT(*) FILTER (WHERE status = 'accepted')  AS accepted
        FROM applications
    `
    var s ApplicationStats
    if err := s.db.QueryRowContext(ctx, query).Scan(&s.Total, &s.Submitted, &s.Accepted); err != nil {
        return nil, err
    }
    // derived fields (e.g., acceptance rate) computed in Go
    return &s, nil
}
```

### Handler

GET only, no params, no validation:

```go
func (app *application) getApplicationStatsHandler(w http.ResponseWriter, r *http.Request) {
    stats, err := app.store.Application.GetStats(r.Context())
    if err != nil {
        app.internalServerError(w, r, err)
        return
    }
    if err := app.jsonResponse(w, http.StatusOK, stats); err != nil {
        app.internalServerError(w, r, err)
    }
}
```

`*store.ApplicationStats` already has snake_case JSON tags, so it can be passed directly to `jsonResponse` without an extra wrapper. (For derived stats with no existing struct, define one in the handler file.)

If the counter would be expensive to compute on every request, cache in the `settings` table and increment in the same transaction as writes — see `incrementScanStat` / `GetScanStats` in `internal/store/{scans,settings}.go`.
