# List with Pagination, Filters, Search, Sort

For list endpoints that return many rows and need cursor pagination, status filtering, search, or sorting. Layer this over `crud-resource.md` — the model and CRUD methods are unchanged; only `List` becomes more complex.

Two pagination styles are in use:
- **Cursor-based** (preferred) — used for applications and the role-mode of users. Forward + backward, base64-encoded JSON cursor.
- **Offset-based** — used for the trigram-style user search (limit/offset). Simpler when the query already filters aggressively.

## When to Use

The list will grow large enough that pagination matters, OR the user wants any of:
- Status / category filters
- Sort by multiple columns
- Free-text search (substring match)

Working examples: **Applications list** (`ApplicationsStore.List`, `listApplicationsHandler`) and **Users role-listing** (`UsersStore.ListUsers`, `listUsersByRole`).

## Cursor Pagination

### Cursor type

Define a struct with the sort key + tiebreaker (always include `id` as a tiebreaker for stable ordering). Use short JSON tags to keep cursors short:

```go
type ApplicationCursor struct {
    CreatedAt time.Time `json:"c"`
    ID        string    `json:"i"`
    SortVal   *int      `json:"v,omitempty"`   // populated only when sorting by a non-time column
}

func EncodeCursor(createdAt time.Time, id string) string {
    cursor := ApplicationCursor{CreatedAt: createdAt, ID: id}
    data, _ := json.Marshal(cursor)
    return base64.URLEncoding.EncodeToString(data)
}

func EncodeSortCursor(sortVal int, id string) string {
    cursor := ApplicationCursor{ID: id, SortVal: &sortVal}
    data, _ := json.Marshal(cursor)
    return base64.URLEncoding.EncodeToString(data)
}

func DecodeCursor(encoded string) (*ApplicationCursor, error) {
    data, err := base64.URLEncoding.DecodeString(encoded)
    if err != nil { return nil, fmt.Errorf("invalid cursor encoding") }
    var c ApplicationCursor
    if err := json.Unmarshal(data, &c); err != nil { return nil, fmt.Errorf("invalid cursor format") }
    if c.ID == "" { return nil, fmt.Errorf("invalid cursor: missing id") }
    if c.CreatedAt.IsZero() && c.SortVal == nil {
        return nil, fmt.Errorf("invalid cursor: missing sort value")
    }
    return &c, nil
}
```

### Direction enum

```go
type PaginationDirection string

const (
    DirectionForward  PaginationDirection = "forward"
    DirectionBackward PaginationDirection = "backward"
)
```

### Filters & sort enums

Whitelist sort columns to **prevent SQL injection** when interpolating into the query string:

```go
type ApplicationSortBy string

const (
    SortByCreatedAt     ApplicationSortBy = "created_at"
    SortByAcceptVotes   ApplicationSortBy = "accept_votes"
    SortByRejectVotes   ApplicationSortBy = "reject_votes"
    SortByWaitlistVotes ApplicationSortBy = "waitlist_votes"
)

func sortColumnName(sortBy ApplicationSortBy) string {
    switch sortBy {
    case SortByAcceptVotes:   return "a.accept_votes"
    case SortByRejectVotes:   return "a.reject_votes"
    case SortByWaitlistVotes: return "a.waitlist_votes"
    default:                  return "a.created_at"
    }
}

type ApplicationListFilters struct {
    Status *ApplicationStatus
    Search *string
    SortBy ApplicationSortBy
}
```

### List signature

```go
func (s *ApplicationsStore) List(
    ctx context.Context,
    filters ApplicationListFilters,
    cursor *ApplicationCursor,
    direction PaginationDirection,
    limit int,
) (*ApplicationListResult, error)
```

Inside:
1. Cap `limit` (default 50, max 100).
2. Build `WHERE` clause: status filter, search clause (`ILIKE`), cursor predicate.
3. Cursor predicate compares `(sort_key, id)` tuple — `<` for forward (DESC), `>` for backward (ASC).
4. Order DESC for forward, ASC for backward.
5. Fetch `limit + 1` rows to detect `HasMore`.
6. If `direction == DirectionBackward`, reverse the slice before returning.
7. Generate `NextCursor` / `PrevCursor` for the slice's first/last items.

Schema:

```go
type ApplicationListResult struct {
    Applications []ApplicationListItem `json:"applications"`
    NextCursor   *string               `json:"next_cursor,omitempty"`
    PrevCursor   *string               `json:"prev_cursor,omitempty"`
    HasMore      bool                  `json:"has_more"`
}
```

See `internal/store/applications.go:325-527` for the canonical implementation, including the dual code path for vote-column vs. created_at sorts. **Don't reinvent it for new resources — copy and adapt.**

### Search clause

Substring match via `ILIKE '%' || $N || '%'`. For multi-field search (e.g., email + first/last name from JSONB), `OR` them and parameterize once:

```sql
AND ($5::text IS NULL OR (
        u.email ILIKE '%' || $5 || '%'
     OR a.responses->>'first_name' ILIKE '%' || $5 || '%'
     OR a.responses->>'last_name'  ILIKE '%' || $5 || '%'
))
```

Reject too-short search input at the handler layer (typically `< 2` chars).

## Handler — Query-Param Parsing

`r.URL.Query()` for each param. Validate with whitelisted enum switch — return 400 on anything else:

```go
func (app *application) listApplicationsHandler(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query()

    // cursor
    var cursor *store.ApplicationCursor
    if cursorStr := query.Get("cursor"); cursorStr != "" {
        var err error
        cursor, err = store.DecodeCursor(cursorStr)
        if err != nil { app.badRequestResponse(w, r, errors.New("invalid cursor")); return }
    }

    // status filter — whitelist
    var filters store.ApplicationListFilters
    if statusStr := query.Get("status"); statusStr != "" {
        status := store.ApplicationStatus(statusStr)
        switch status {
        case store.StatusDraft, store.StatusSubmitted, store.StatusAccepted,
             store.StatusRejected, store.StatusWaitlisted:
            filters.Status = &status
        default:
            app.badRequestResponse(w, r, errors.New("invalid status value"))
            return
        }
    }

    // search — length bounds
    if searchStr := query.Get("search"); searchStr != "" {
        if len(searchStr) < 2 || len(searchStr) > 100 {
            app.badRequestResponse(w, r, errors.New("search must be 2-100 characters"))
            return
        }
        filters.Search = &searchStr
    }

    // limit — bounded
    limit := 50
    if limitStr := query.Get("limit"); limitStr != "" {
        n, err := strconv.Atoi(limitStr)
        if err != nil || n < 1 || n > 100 {
            app.badRequestResponse(w, r, errors.New("limit must be between 1 and 100"))
            return
        }
        limit = n
    }

    // direction — enum
    direction := store.DirectionForward
    if dirStr := query.Get("direction"); dirStr != "" {
        switch store.PaginationDirection(dirStr) {
        case store.DirectionForward, store.DirectionBackward:
            direction = store.PaginationDirection(dirStr)
        default:
            app.badRequestResponse(w, r, errors.New("direction must be 'forward' or 'backward'"))
            return
        }
    }

    // sort_by — whitelist
    if sortStr := query.Get("sort_by"); sortStr != "" {
        switch store.ApplicationSortBy(sortStr) {
        case store.SortByCreatedAt, store.SortByAcceptVotes,
             store.SortByRejectVotes, store.SortByWaitlistVotes:
            filters.SortBy = store.ApplicationSortBy(sortStr)
        default:
            app.badRequestResponse(w, r, errors.New("invalid sort_by value"))
            return
        }
    }

    result, err := app.store.Application.List(r.Context(), filters, cursor, direction, limit)
    if err != nil { app.internalServerError(w, r, err); return }

    app.jsonResponse(w, http.StatusOK, result)
}
```

The store's `*ApplicationListResult` already has snake_case JSON tags so it can pass directly to `jsonResponse` without an extra wrapper.

### Swagger params

```go
//  @Param cursor    query string false "Pagination cursor"
//  @Param status    query string false "Filter by status (draft, submitted, ...)"
//  @Param limit     query int    false "Page size (default 50, max 100)"
//  @Param direction query string false "forward or backward"
//  @Param sort_by   query string false "Sort column"
//  @Success 200 {object} store.ApplicationListResult
```

## Offset Pagination (Search)

Simpler — appropriate for trigram/ILIKE search where users page through a small result set. Used for `searchUsersHandler`:

```go
func (s *UsersStore) Search(ctx context.Context, query string, limit int, offset int) (*UserSearchResult, error) {
    // ... clamp limit, offset >= 0 ...
    // first query: COUNT(*) for total
    // second query: SELECT ... LIMIT $2 OFFSET $3
}

type UserSearchResult struct {
    Users      []UserListItem `json:"users"`
    TotalCount int            `json:"total_count"`
}
```

Handler validates `search` is 2-100 chars and clamps `limit`/`offset`. Use this only when the search clause is selective enough that paging far isn't a concern.

## Tests

Coverage checklist for cursor-paginated list:

| Case | Expected |
|------|----------|
| No filters | 200 with default cursor/direction passed to store |
| Invalid status | 400 |
| Invalid limit (< 1, > 100, NaN) | 400 |
| Invalid direction | 400 |
| Invalid sort_by | 400 |
| Search too short / too long | 400 |
| Valid combination | 200, store called with parsed filters |

Mock pattern — assert exact filters passed:

```go
search := "john"
mockApps.On("List",
    store.ApplicationListFilters{Search: &search},
    (*store.ApplicationCursor)(nil),
    store.DirectionForward,
    50,
).Return(result, nil).Once()
```

See `cmd/api/applications_test.go:380-545`.

## What NOT to Do

- Don't interpolate user-supplied strings into the SQL query directly. Whitelist sort columns and use placeholders for everything else.
- Don't return `null` for an empty list — the cursor pagination layer at the store already initializes the slice; for nested fields, do `if items == nil { items = []T{} }`.
- Don't forget the `id` tiebreaker — without it, identical sort values produce non-deterministic page boundaries.
- Don't roll a new cursor format — copy the `(time, id)` or `(int, id)` shape.
