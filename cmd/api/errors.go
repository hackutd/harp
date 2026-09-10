package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/hackutd/harp/internal/store"
)

func (app *application) internalServerError(w http.ResponseWriter, r *http.Request, err error) {
	// Don't log or respond for cancelled requests — client is already gone
	if r.Context().Err() == context.Canceled {
		return
	}

	app.logger.Errorw("internal error", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusInternalServerError, "the server encountered a problem")
}

func (app *application) forbiddenResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("forbidden", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusForbidden, "forbidden")
}

// forbiddenMessageResponse refuses a request and tells the caller why.
// forbiddenResponse hides the reason behind a flat "forbidden", which is the
// right default for hacker-facing routes but useless on the admin scanner,
// where a volunteer needs to know whether to send someone to the RSVP desk or
// the walk-in line. Use it only where the caller is already trusted staff.
func (app *application) forbiddenMessageResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("forbidden", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusForbidden, err.Error())
}

func (app *application) badRequestResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("bad request", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusBadRequest,
		err.Error())
}

// validationErrorResponse reports schema-validation failures. The message keeps
// its historical shape for compatibility; the field ids let the form map each
// failure back onto the question that caused it.
func (app *application) validationErrorResponse(w http.ResponseWriter, r *http.Request, errs []fieldValidationError) {
	message := fmt.Sprintf("validation errors: %v", validationMessages(errs))

	app.logger.Warnw("validation failed", "method", r.Method, "path", r.URL.Path, "error", message)

	writeJSONFieldError(w, http.StatusBadRequest, message, validationFieldIDs(errs))
}

func (app *application) conflictResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Errorw("conflict response", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusConflict, err.Error())
}

func (app *application) notFoundResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("not found error", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusNotFound,
		"not found")
}

func (app *application) unauthorizedErrorResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("unauthorized error", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	writeJSONError(w, http.StatusUnauthorized, "unauthorized")
}

func (app *application) unauthorizedBasicErrorResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.logger.Warnw("unauthorized basic error", "method", r.Method, "path", r.URL.Path, "error", err.Error())

	w.Header().Set("WWW-Authenticate", `Basic realm="restricted", charset="UTF-8"`)

	writeJSONError(w, http.StatusUnauthorized, "unauthorized")
}

func (app *application) rateLimiterExceededResponse(w http.ResponseWriter, r *http.Request, key, retryAfter string) {
	app.logger.Warnw("rate limit exceeded", "method", r.Method, "path", r.URL.Path, "key", key)

	w.Header().Set("Retry-After", retryAfter)

	writeJSONError(w, http.StatusTooManyRequests, "rate limit exceeded, retry after: "+retryAfter)
}

func (app *application) authMethodMismatchResponse(w http.ResponseWriter, r *http.Request, expected, got store.AuthMethod) {
	app.logger.Warnw("auth method mismatch", "method", r.Method, "path", r.URL.Path, "expected", expected, "got", got)

	var msg string
	if expected == store.AuthMethodPasswordless {
		msg = "This email is registered with magic link sign-in. Please use the email option instead."
	} else {
		msg = "This email is registered with Google. Please use the Google sign-in option instead."
	}
	writeJSONError(w, http.StatusConflict, msg)
}
