# Settings Pattern Reference

Settings are key-value pairs in the `settings` table with JSONB values. All settings code lives in `SettingsStore` / `Settings` interface — never in resource-specific stores.

## Migration

```sql
-- Up
INSERT INTO settings (key, value) VALUES ('my_setting', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Down
DELETE FROM settings WHERE key = 'my_setting';
```

## Store (`internal/store/settings.go`)

Define a constant — never hardcode key strings:

```go
const SettingsKeyMySetting = "my_setting"
```

### Getter

Scan into `[]byte` + `json.Unmarshal`. Handle `sql.ErrNoRows` with a sensible default.

```go
func (s *SettingsStore) GetMySettingEnabled(ctx context.Context) (bool, error) {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    var value []byte
    err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = $1`, SettingsKeyMySetting).Scan(&value)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return true, nil
        }
        return false, err
    }

    var enabled bool
    if err := json.Unmarshal(value, &enabled); err != nil {
        return false, err
    }
    return enabled, nil
}
```

### Setter

Return only `error`. Use `json.Marshal` + upsert.

```go
func (s *SettingsStore) SetMySettingEnabled(ctx context.Context, enabled bool) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    jsonValue, err := json.Marshal(enabled)
    if err != nil {
        return err
    }

    query := `
        INSERT INTO settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `
    _, err = s.db.ExecContext(ctx, query, SettingsKeyMySetting, string(jsonValue))
    return err
}
```

## Interface (`internal/store/storage.go`)

```go
Settings interface {
    GetMySettingEnabled(ctx context.Context) (bool, error)
    SetMySettingEnabled(ctx context.Context, enabled bool) error
}
```

## Mock (`internal/store/mock_store.go`)

```go
func (m *MockSettingsStore) GetMySettingEnabled(ctx context.Context) (bool, error) {
    args := m.Called()
    return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetMySettingEnabled(ctx context.Context, enabled bool) error {
    args := m.Called(enabled)
    return args.Error(0)
}
```

Use `args.Bool(0)` for booleans. Pass params (except ctx) to `m.Called()`.

## Handlers (`cmd/api/settings.go`)

Payload, response structs, and handlers all live in `settings.go`.

```go
type SetMySettingPayload struct {
    Enabled bool `json:"enabled"`
}

type MySettingResponse struct {
    Enabled bool `json:"enabled"`
}
```

Setter handlers use `readJSON` with a payload struct — never query params. Swagger `@Tags` is `superadmin/settings`. Response can type-convert from payload: `MySettingResponse(req)`.

## Settings-Gated Middleware (`cmd/api/middlewares.go`)

```go
func (app *application) MySettingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
            app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
            return
        }
        if user.Role == store.RoleSuperAdmin {
            next.ServeHTTP(w, r)
            return
        }
        enabled, err := app.store.Settings.GetMySettingEnabled(r.Context())
        if err != nil {
            app.internalServerError(w, r, err)
            return
        }
        if !enabled {
            app.forbiddenResponse(w, r, fmt.Errorf("feature is currently disabled"))
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

Wire with `r.Group` + `r.Use` in `api.go`.

## Middleware Test Coverage

| Case | Expected |
|------|----------|
| No user in context | 401 |
| Disabled + non-super-admin | 403 |
| Enabled + non-super-admin | 200 |
| Super admin + disabled | 200 (bypass) |
| Store error | 500 |
