package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSPAHandler(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "assets"), 0o755))
	for name, body := range map[string]string{
		"index.html":                 "<html>shell</html>",
		"sw.js":                      "// service worker",
		"assets/index-BqBv7BiL.js":   "console.log('entry')",
		"assets/index-BqBv7BiL.css":  "body{}",
		"email-assets/zero-day.webp": "webp",
	} {
		require.NoError(t, os.MkdirAll(filepath.Dir(filepath.Join(dir, name)), 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644))
	}

	h := (&application{}).spaHandler(dir)
	get := func(p string) *httptest.ResponseRecorder {
		return executeRequest(httptest.NewRequest(http.MethodGet, p, nil), h)
	}

	t.Run("client routes fall back to the shell and always revalidate", func(t *testing.T) {
		for _, p := range []string{"/", "/app", "/app/application", "/app/faq", "/admin/sa/forms/rsvp"} {
			rr := get(p)
			checkResponseCode(t, http.StatusOK, rr.Code)
			assert.Equal(t, "<html>shell</html>", rr.Body.String(), p)
			assert.Contains(t, rr.Header().Get("Content-Type"), "text/html", p)
			assert.Equal(t, "no-cache", rr.Header().Get("Cache-Control"), p)
		}
	})

	t.Run("fingerprinted assets are served immutable", func(t *testing.T) {
		rr := get("/assets/index-BqBv7BiL.js")
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "console.log('entry')", rr.Body.String())
		assert.Contains(t, rr.Header().Get("Content-Type"), "javascript")
		assert.Equal(t, "public, max-age=31536000, immutable", rr.Header().Get("Cache-Control"))

		rr = get("/assets/index-BqBv7BiL.css")
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "public, max-age=31536000, immutable", rr.Header().Get("Cache-Control"))
	})

	t.Run("non-fingerprinted files revalidate on every request", func(t *testing.T) {
		for _, p := range []string{"/sw.js", "/email-assets/zero-day.webp"} {
			rr := get(p)
			checkResponseCode(t, http.StatusOK, rr.Code)
			assert.Equal(t, "no-cache", rr.Header().Get("Cache-Control"), p)
		}
	})

	t.Run("a chunk from a previous build is a 404, never the shell", func(t *testing.T) {
		for _, p := range []string{"/assets/ApplicationDetailPage-MakAPDWx.js", "/assets/FAQPage-old.js", "/missing.png"} {
			rr := get(p)
			checkResponseCode(t, http.StatusNotFound, rr.Code)
			assert.NotContains(t, rr.Body.String(), "shell", p)
			assert.Equal(t, "no-store", rr.Header().Get("Cache-Control"), p)
		}
	})

	t.Run("path traversal cannot escape the static dir", func(t *testing.T) {
		rr := get("/../spa.go")
		assert.NotContains(t, rr.Body.String(), "package main")
	})
}
