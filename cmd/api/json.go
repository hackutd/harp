package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"
)

var Validate *validator.Validate

func init() {
	Validate = validator.New(validator.WithRequiredStructEnabled())
}

func writeJSON(w http.ResponseWriter, status int, data any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func readJSON(w http.ResponseWriter, r *http.Request, data any) error {
	maxBytes := 1_048_578 // 1mb
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxBytes))

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	return decoder.Decode(data)
}

func writeJSONError(w http.ResponseWriter, status int, message string) error {
	type envolope struct {
		Error string `json:"error"`
	}

	return writeJSON(w, status, &envolope{Error: message})
}

// writeJSONFieldError writes the standard error envelope plus the ids of the
// fields the request was rejected for, so a client form can blame its own
// inputs instead of surfacing the raw message.
func writeJSONFieldError(w http.ResponseWriter, status int, message string, fields []string) error {
	type envelope struct {
		Error  string   `json:"error"`
		Fields []string `json:"fields,omitempty"`
	}

	return writeJSON(w, status, &envelope{Error: message, Fields: fields})
}

func (app *application) jsonResponse(w http.ResponseWriter, status int, data any) error {
	type envelope struct {
		Data any `json:"data"`
	}

	return writeJSON(w, status, &envelope{Data: data})
}
