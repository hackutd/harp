package main

import (
	"net/http"
	"os"
	"path/filepath"
)

func (app *application) spaHandler(staticDir string) http.HandlerFunc {
	fileServer := http.FileServer(http.Dir(staticDir))

	return func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			// SPA fallback
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		fileServer.ServeHTTP(w, r)
	}
}
