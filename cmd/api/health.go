package main

import (
	"context"
	"net/http"
	"time"
)

const healthDBTimeout = 2 * time.Second

// healthCheckHandler godoc
//
//	@Summary		Health check endpoint
//	@Description	Returns the health status of the API, including database reachability. Responds 503 when the database cannot be reached.
//	@Tags			health
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	map[string]string	"status, environment, version and database state"
//	@Failure		503	{object}	map[string]string	"database unreachable"
//	@Security		BasicAuth
//	@Router			/health [get]
func (app *application) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]string{
		"status":   "ok",
		"env":      app.config.env,
		"version":  app.config.observability.version,
		"database": "skipped",
	}
	status := http.StatusOK

	if app.dbPinger != nil {
		ctx, cancel := context.WithTimeout(r.Context(), healthDBTimeout)
		defer cancel()

		if err := app.dbPinger.PingContext(ctx); err != nil {
			app.requestLogger(r).Errorw("health check: database unreachable", "error", err)
			data["status"] = "degraded"
			data["database"] = "unreachable"
			status = http.StatusServiceUnavailable
		} else {
			data["database"] = "ok"
		}
	}

	if err := writeJSON(w, status, data); err != nil {
		app.requestLogger(r).Errorw("health check: failed to write response", "error", err)
	}
}
