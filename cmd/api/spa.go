package main

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// spaHandler serves the built portal. Vite fingerprints everything under
// /assets, so those files never change once they exist and can be cached
// forever; the shell (index.html), the service worker and the manifest are
// rewritten on every deploy and must always be revalidated.
//
// A missing file with an extension is a real 404, not a client route. Falling
// back to index.html there handed browsers HTML in place of a module script
// ("'text/html' is not a valid JavaScript MIME type") whenever a page loaded
// before a deploy lazy-imported a chunk from the previous build, and Cloudflare
// then cached that HTML under the .js URL for everyone behind that edge.
func (app *application) spaHandler(staticDir string) http.HandlerFunc {
	fileServer := http.FileServer(http.Dir(staticDir))
	index := filepath.Join(staticDir, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		fsPath := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
		info, err := os.Stat(fsPath)
		if err != nil || info.IsDir() {
			if path.Ext(r.URL.Path) != "" {
				w.Header().Set("Cache-Control", "no-store")
				http.NotFound(w, r)
				return
			}
			// SPA fallback
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, index)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	}
}
