package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/hackutd/harp/internal/logger"
	"github.com/hackutd/harp/internal/store"
)

// internalServerError logs a 500 as an Error Reporting event. The report
// location is the handler call site so each distinct failure path becomes its
// own Error Reporting group rather than everything collapsing into errors.go.
func (app *application) internalServerError(w http.ResponseWriter, r *http.Request, err error) {
	// Don't log or respond for cancelled requests — client is already gone
	if r.Context().Err() == context.Canceled {
		return
	}

	errCtx := logger.ErrorContext{
		HTTPRequest:    logger.HTTPRequestFromRequest(r, clientIP(r), http.StatusInternalServerError),
		ReportLocation: callerLocation(1),
	}
	app.requestLogger(r).Desugar().
		With(logger.ErrorReportFields(app.serviceContext(), errCtx, nil)...).
		Error("internal error: " + err.Error())

	writeJSONError(w, http.StatusInternalServerError, "the server encountered a problem")
}

func (app *application) forbiddenResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("forbidden", "error", err.Error())

	writeJSONError(w, http.StatusForbidden, "forbidden")
}

func (app *application) badRequestResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("bad request", "error", err.Error())

	writeJSONError(w, http.StatusBadRequest,
		err.Error())
}

// validationErrorResponse reports schema-validation failures. The message keeps
// its historical shape for compatibility; the field ids let the form map each
// failure back onto the question that caused it.
func (app *application) validationErrorResponse(w http.ResponseWriter, r *http.Request, errs []fieldValidationError) {
	message := fmt.Sprintf("validation errors: %v", validationMessages(errs))

	app.requestLogger(r).Warnw("validation failed", "error", message)

	writeJSONFieldError(w, http.StatusBadRequest, message, validationFieldIDs(errs))
}

// conflictResponse is a client-side race or duplicate, not a server fault, so
// it logs at WARNING like the other 4xx helpers.
func (app *application) conflictResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("conflict response", "error", err.Error())

	writeJSONError(w, http.StatusConflict, err.Error())
}

func (app *application) notFoundResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("not found error", "error", err.Error())

	writeJSONError(w, http.StatusNotFound,
		"not found")
}

func (app *application) unauthorizedErrorResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("unauthorized error", "error", err.Error())

	writeJSONError(w, http.StatusUnauthorized, "unauthorized")
}

func (app *application) unauthorizedBasicErrorResponse(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("unauthorized basic error", "error", err.Error())

	w.Header().Set("WWW-Authenticate", `Basic realm="restricted", charset="UTF-8"`)

	writeJSONError(w, http.StatusUnauthorized, "unauthorized")
}

func (app *application) rateLimiterExceededResponse(w http.ResponseWriter, r *http.Request, key, retryAfter string) {
	app.requestLogger(r).Warnw("rate limit exceeded", "key", key)

	w.Header().Set("Retry-After", retryAfter)

	writeJSONError(w, http.StatusTooManyRequests, "rate limit exceeded, retry after: "+retryAfter)
}

func (app *application) authMethodMismatchResponse(w http.ResponseWriter, r *http.Request, expected, got store.AuthMethod) {
	app.requestLogger(r).Warnw("auth method mismatch", "expected", expected, "got", got)

	var msg string
	if expected == store.AuthMethodPasswordless {
		msg = "This email is registered with magic link sign-in. Please use the email option instead."
	} else {
		msg = "This email is registered with Google. Please use the Google sign-in option instead."
	}
	writeJSONError(w, http.StatusConflict, msg)
}
