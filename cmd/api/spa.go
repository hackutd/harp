package main

import (
	"net/http"
	"os"
	"path/filepath"
)

// spaHandler returns an http.Handler that serves static files from the given
// directory. If the requested path does not match a file on disk, it falls
// back to serving index.html so that client-side routing (React Router) works.
func (app *application) spaHandler(staticDir string) http.HandlerFunc {
	fileServer := http.FileServer(http.Dir(staticDir))

	return func(w http.ResponseWriter, r *http.Request) {
		// Check if the requested file exists on disk
		path := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			// File doesn't exist or is a directory — serve index.html (SPA fallback)
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		// File exists — serve it directly
		fileServer.ServeHTTP(w, r)
	}
}
