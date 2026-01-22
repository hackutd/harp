package main

import (
	"encoding/json"
	"log"
	"net/http"
)

// healthCheckHandler godoc
//	@Summary		Health check endpoint
//	@Description	Returns the health status of the API
//	@Tags			health
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	map[string]string	"status and environment"
//	@Security		BasicAuth
//	@Router			/health [get]
func (app *application) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]string {
		"status": "ok", 
		"env": app.config.env,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	err := json.NewEncoder(w).Encode(data)
	if err != nil {
		log.Println("internal server error: ")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
	}
}