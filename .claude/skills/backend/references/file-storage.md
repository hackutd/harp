# File Storage Pattern

Two file-upload patterns in the codebase, picked by file size:

| Pattern | Examples | Use when |
|---------|----------|----------|
| **Signed URL (GCS)** | Resume upload/download | Files >100KB, especially user-uploaded content (PDFs, images) where you want to offload bandwidth from the API |
| **Base64 JSON in DB** | Sponsor logo | Files <1MB, admin-uploaded, where you want a single round-trip and the convenience of having the bytes available with the row |

## When to Use Which

- The user is going to upload directly from a browser → Signed URL.
- The thing is small, served alongside the resource, and admin-only → Base64 JSON.
- It's cheap to serve from the DB and you don't want a separate cleanup pipeline → Base64 JSON.
- It's a multi-megabyte file → Signed URL.

## Signed URL Pattern (GCS)

The backend mints a short-lived signed URL; the client `PUT`s the bytes directly to GCS, then sends the resulting object path back to the API on the next mutation.

Working example: **Resume** (`cmd/api/resume.go`).

### `app.gcsClient` interface

```go
// internal/gcs/client.go (already exists)
type Client interface {
    GenerateUploadURL(ctx context.Context, objectPath string) (string, error)
    GenerateDownloadURL(ctx context.Context, objectPath string) (string, error)
    DeleteObject(ctx context.Context, objectPath string) error
}
```

### Generate Upload URL

```go
const randomResumeObjectIDBytes = 16

type ResumeUploadURLResponse struct {
    UploadURL  string `json:"upload_url"`
    ResumePath string `json:"resume_path"`
}

func (app *application) generateResumeUploadURLHandler(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user == nil { app.unauthorizedErrorResponse(w, r, errors.New("missing user")); return }

    // 1) Pre-flight ownership/state checks
    application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("application not found")); return
        }
        app.internalServerError(w, r, err); return
    }
    if application.Status != store.StatusDraft {
        app.conflictResponse(w, r, errors.New("cannot update submitted application")); return
    }

    // 2) GCS configured?
    if app.gcsClient == nil {
        app.logger.Warnw("resume upload url requested but gcs is not configured", "user_id", user.ID)
        writeJSONError(w, http.StatusServiceUnavailable, "resume uploads are not configured")
        return
    }

    // 3) Random object path scoped under the user
    randomID, err := randomHex(randomResumeObjectIDBytes)
    if err != nil { app.internalServerError(w, r, err); return }
    objectPath := fmt.Sprintf("resumes/%s/%s.pdf", user.ID, randomID)

    // 4) Mint signed URL
    uploadURL, err := app.gcsClient.GenerateUploadURL(r.Context(), objectPath)
    if err != nil { app.internalServerError(w, r, err); return }

    app.jsonResponse(w, http.StatusOK, ResumeUploadURLResponse{
        UploadURL:  uploadURL,
        ResumePath: objectPath,
    })
}

func randomHex(size int) (string, error) {
    buf := make([]byte, size)
    if _, err := rand.Read(buf); err != nil { return "", err }
    return hex.EncodeToString(buf), nil
}
```

Key details:
- **Object path** is `<resource>/<owner_id>/<random>.<ext>` — owner-scoped to keep ACLs simple.
- **Random ID** uses `crypto/rand` (`randomHex`) — no enumeration via guessable paths.
- **GCS not configured** → 503 `Service Unavailable`. This is a deployment state, not a logic error; don't 500.
- **Frontend stores the resume path** on the resource via the regular update endpoint (e.g., PATCH `/applications/me` with `{"resume_path": "..."}`). The signed-URL handler does not write the path itself.

### Generate Download URL

For admin viewing — same shape, but loads the resource by ID and uses its `ResumePath`:

```go
type ResumeDownloadURLResponse struct {
    DownloadURL string `json:"download_url"`
}

func (app *application) getResumeDownloadURLHandler(w http.ResponseWriter, r *http.Request) {
    applicationID := chi.URLParam(r, "applicationID")
    if applicationID == "" {
        app.badRequestResponse(w, r, errors.New("application ID is required")); return
    }

    application, err := app.store.Application.GetByID(r.Context(), applicationID)
    if err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("application not found")); return
        }
        app.internalServerError(w, r, err); return
    }
    if application.ResumePath == nil {
        app.notFoundResponse(w, r, errors.New("resume not found")); return
    }
    if app.gcsClient == nil {
        writeJSONError(w, http.StatusServiceUnavailable, "resume downloads are not configured")
        return
    }

    downloadURL, err := app.gcsClient.GenerateDownloadURL(r.Context(), *application.ResumePath)
    if err != nil { app.internalServerError(w, r, err); return }

    app.jsonResponse(w, http.StatusOK, ResumeDownloadURLResponse{DownloadURL: downloadURL})
}
```

### Delete

Two-step: best-effort GCS delete (logged on failure, doesn't block) + clear the path on the row.

```go
func (app *application) deleteResumeHandler(w http.ResponseWriter, r *http.Request) {
    user := getUserFromContext(r.Context())
    if user == nil { app.unauthorizedErrorResponse(w, r, nil); return }

    application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
    if err != nil { /* ... 404 / 500 ... */ }
    if application.Status != store.StatusDraft { /* ... 409 ... */ }
    if application.ResumePath == nil { /* ... 404 ... */ }

    if app.gcsClient != nil {
        if err := app.gcsClient.DeleteObject(r.Context(), *application.ResumePath); err != nil {
            // Best-effort — orphaned object cleanup is acceptable
            app.logger.Warnw("failed to delete resume from gcs",
                "application_id", application.ID,
                "resume_path", *application.ResumePath,
                "error", err)
        }
    }

    application.ResumePath = nil
    if err := app.store.Application.Update(r.Context(), application); err != nil {
        app.internalServerError(w, r, err); return
    }
    app.jsonResponse(w, http.StatusOK, application)
}
```

Treat GCS delete as best-effort — orphaned objects are cheap; a failed transactional cleanup blocks the user.

### Routes

Upload/download go in the appropriate auth group:

```go
// Hacker self-resource (under AuthRequiredMiddleware + ApplicationsEnabledMiddleware)
r.Post("/me/resume-upload-url", app.generateResumeUploadURLHandler)
r.Delete("/me/resume",          app.deleteResumeHandler)

// Admin (under RequireRoleMiddleware(RoleAdmin))
r.Get("/{applicationID}/resume-url", app.getResumeDownloadURLHandler)
```

## Base64 JSON Pattern

For small files where the bytes live with the row. Working example: **Sponsor logo** (`cmd/api/sponsors.go:198-276`).

### Schema

Two columns on the parent row — `<thing>_data TEXT` and `<thing>_content_type TEXT`:

```sql
logo_data         TEXT NOT NULL DEFAULT '',
logo_content_type TEXT NOT NULL DEFAULT '',
```

### Handler

```go
var allowedLogoContentTypes = map[string]bool{
    "image/png":  true,
    "image/jpeg": true,
    "image/webp": true,
    "image/gif":  true,
}

const maxLogoBytes = 1 * 1024 * 1024 // 1MB decoded

type LogoUploadPayload struct {
    LogoData    string `json:"logo_data"     validate:"required"`
    ContentType string `json:"content_type"  validate:"required"`
}

func (app *application) uploadLogoHandler(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "sponsorID")
    if id == "" { app.badRequestResponse(w, r, errors.New("missing sponsor ID")); return }

    // 1) Confirm the parent exists (so we can return 404 cleanly)
    if _, err := app.store.Sponsors.GetByID(r.Context(), id); err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("sponsor not found")); return
        }
        app.internalServerError(w, r, err); return
    }

    // 2) Parse + validate
    var p LogoUploadPayload
    if err := readJSON(w, r, &p); err != nil   { app.badRequestResponse(w, r, err); return }
    if err := Validate.Struct(p); err != nil   { app.badRequestResponse(w, r, err); return }
    if !allowedLogoContentTypes[p.ContentType] {
        app.badRequestResponse(w, r, fmt.Errorf("unsupported content type: %s", p.ContentType))
        return
    }

    // 3) Decode + size check
    decoded, err := base64.StdEncoding.DecodeString(p.LogoData)
    if err != nil { app.badRequestResponse(w, r, errors.New("invalid base64 data")); return }
    if len(decoded) > maxLogoBytes {
        app.badRequestResponse(w, r, fmt.Errorf("logo exceeds maximum size of %d bytes", maxLogoBytes))
        return
    }

    // 4) Persist (we keep the base64 string, not raw bytes — easier for direct JSON serving)
    if err := app.store.Sponsors.UpdateLogo(r.Context(), id, p.LogoData, p.ContentType); err != nil {
        if errors.Is(err, store.ErrNotFound) {
            app.notFoundResponse(w, r, errors.New("sponsor not found")); return
        }
        app.internalServerError(w, r, err); return
    }

    sponsor, err := app.store.Sponsors.GetByID(r.Context(), id)
    if err != nil { app.internalServerError(w, r, err); return }
    app.jsonResponse(w, http.StatusOK, sponsor)
}
```

Defense layers in order: payload required → content type allowlist → decode validation → size cap.

The validator's `MaxBytesReader` in `readJSON` already enforces a 1MB body cap; this is a second, semantic check that makes the error message specific.

### Store

```go
func (s *SponsorsStore) UpdateLogo(ctx context.Context, id string, data string, contentType string) error {
    ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
    defer cancel()

    result, err := s.db.ExecContext(ctx,
        `UPDATE sponsors SET logo_data = $1, logo_content_type = $2 WHERE id = $3`,
        data, contentType, id)
    if err != nil { return err }
    rows, err := result.RowsAffected()
    if err != nil { return err }
    if rows == 0 { return ErrNotFound }
    return nil
}
```

## Tests

Coverage checklist for signed-URL upload:

| Case | Expected |
|------|----------|
| Success | 200 with `upload_url` + `resume_path` (verify path prefix and extension) |
| Resource not found | 404 |
| Wrong state (e.g., submitted) | 409 |
| GCS not configured | 503 |
| GCS signing fails | 500 |

Mock GCS setup:

```go
mockGCS := app.gcsClient.(*gcs.MockClient)
mockGCS.On(
    "GenerateUploadURL",
    mock.Anything,
    mock.MatchedBy(func(p string) bool {
        return strings.HasPrefix(p, "resumes/"+user.ID+"/") && strings.HasSuffix(p, ".pdf")
    }),
).Return("https://upload.example.com", nil).Once()
```

To test the "not configured" case, set `app.gcsClient = nil` for that subtest and restore it afterward (see `cmd/api/resume_test.go:86-101`).

For base64 upload: same shape plus `400` cases for invalid content type, invalid base64, oversized payload.

## What NOT to Do

- Don't proxy the file bytes through the backend if you can sign and let the client upload directly.
- Don't trust the resource path coming back from the client without scoping it under the owner — always re-derive on read (e.g., look up `application.ResumePath` server-side).
- Don't 500 when GCS isn't configured — that's a 503, and log a warning so ops sees it.
- Don't fail the user's mutation when GCS delete fails — log it best-effort and continue.
- Don't decode-and-store raw bytes for the base64 pattern; keep the base64 string so the row can be JSON-serialized as-is.
