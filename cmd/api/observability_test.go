package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/hackutd/harp/internal/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

// newObservedApplication swaps the nop logger for one whose entries can be
// asserted on.
func newObservedApplication(t *testing.T) (*application, *observer.ObservedLogs) {
	t.Helper()
	app := newTestApplication(t)
	core, logs := observer.New(zapcore.DebugLevel)
	app.logger = zap.New(core).Sugar()
	app.config.observability = observabilityConfig{projectID: "test-project", service: "harp", version: "test"}
	app.config.clientIP.header = "CF-Connecting-IP"
	return app, logs
}

// observedRouter mounts the production middleware chain around a handful of
// handlers so the access log, panic recovery and request-logger plumbing can
// be exercised without SuperTokens.
func observedRouter(app *application) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(app.clientIPMiddleware())
	r.Use(app.requestLoggingMiddleware)
	r.Get("/v1/ok/{id}", func(w http.ResponseWriter, r *http.Request) {
		app.requestLogger(r).Infow("inside handler")
		w.WriteHeader(http.StatusNoContent)
	})
	r.Get("/v1/boom", func(w http.ResponseWriter, r *http.Request) {
		panic("kaboom")
	})
	r.Get("/v1/fail", func(w http.ResponseWriter, r *http.Request) {
		app.internalServerError(w, r, errors.New("db exploded"))
	})
	r.Get("/v1/abort", func(w http.ResponseWriter, r *http.Request) {
		panic(http.ErrAbortHandler)
	})
	r.Get("/assets/app.js", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("js"))
	})
	return r
}

func fieldMap(e observer.LoggedEntry) map[string]any {
	return e.ContextMap()
}

func TestRequestLoggingMiddleware(t *testing.T) {
	t.Run("access log carries httpRequest, route, request id and trace", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		req := httptest.NewRequest(http.MethodGet, "/v1/ok/42?secret=1", nil)
		req.Host = "harp.example.com"
		req.Header.Set("X-Cloud-Trace-Context", "105445aa7843bc8bf206b12000100000/1;o=1")
		req.Header.Set("User-Agent", "ua")
		req.Header.Set("CF-Connecting-IP", "203.0.113.9")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		entries := logs.All()
		require.Len(t, entries, 2)

		inside := entries[0]
		assert.Equal(t, "inside handler", inside.Message)
		insideFields := fieldMap(inside)
		assert.Equal(t, "projects/test-project/traces/105445aa7843bc8bf206b12000100000", insideFields[logger.TraceKey])
		assert.Equal(t, "0000000000000001", insideFields[logger.SpanIDKey])
		assert.Equal(t, true, insideFields[logger.TraceSampledKey])
		assert.NotEmpty(t, insideFields["request_id"])

		access := entries[1]
		assert.Equal(t, zapcore.InfoLevel, access.Level)
		assert.Equal(t, "request completed", access.Message)
		fields := fieldMap(access)
		assert.Equal(t, insideFields["request_id"], fields["request_id"], "handler and access log share the request id")
		assert.Equal(t, "/v1/ok/{id}", fields["route"])
		assert.Equal(t, insideFields[logger.TraceKey], fields[logger.TraceKey])

		httpReq, ok := fields["httpRequest"].(map[string]any)
		require.True(t, ok, "httpRequest should be an object")
		assert.Equal(t, "GET", httpReq["requestMethod"])
		assert.Equal(t, "http://harp.example.com/v1/ok/42", httpReq["requestUrl"], "query string must be dropped")
		assert.Equal(t, 204, httpReq["status"])
		assert.Equal(t, "ua", httpReq["userAgent"])
		assert.Equal(t, "203.0.113.9", httpReq["remoteIp"])
		assert.Regexp(t, `^\d+\.\d{9}s$`, httpReq["latency"])
		assert.Equal(t, "0", httpReq["responseSize"])
		assert.Equal(t, "HTTP/1.1", httpReq["protocol"])
	})

	t.Run("no trace headers means no trace fields", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		rr := executeRequest(httptest.NewRequest(http.MethodGet, "/v1/ok/1", nil), mux)
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		fields := fieldMap(logs.All()[1])
		_, hasTrace := fields[logger.TraceKey]
		assert.False(t, hasTrace)
	})

	t.Run("trace fields omitted when project id is unknown", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		app.config.observability.projectID = ""
		mux := observedRouter(app)

		req := httptest.NewRequest(http.MethodGet, "/v1/ok/1", nil)
		req.Header.Set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
		executeRequest(req, mux)

		fields := fieldMap(logs.All()[1])
		_, hasTrace := fields[logger.TraceKey]
		assert.False(t, hasTrace)
	})

	t.Run("panic becomes a 500 with an Error Reporting event", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		rr := executeRequest(httptest.NewRequest(http.MethodGet, "/v1/boom", nil), mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		var body map[string]string
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, "the server encountered a problem", body["error"])

		entries := logs.All()
		require.Len(t, entries, 2)

		panicEntry := entries[0]
		assert.Equal(t, zapcore.ErrorLevel, panicEntry.Level)
		assert.Equal(t, "panic: kaboom", panicEntry.Message)
		fields := fieldMap(panicEntry)
		assert.Equal(t, logger.ErrorReportType, fields["@type"])
		assert.Contains(t, fields["stack_trace"], "goroutine")
		assert.Contains(t, fields["stack_trace"], "observability_test.go")
		svc, ok := fields["serviceContext"].(logger.ServiceContext)
		require.True(t, ok)
		assert.Equal(t, logger.ServiceContext{Service: "harp", Version: "test"}, svc)

		access := entries[1]
		assert.Equal(t, zapcore.ErrorLevel, access.Level)
		httpReq := fieldMap(access)["httpRequest"].(map[string]any)
		assert.Equal(t, 500, httpReq["status"])
	})

	t.Run("http.ErrAbortHandler is re-raised, not logged as a panic", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		assert.PanicsWithValue(t, http.ErrAbortHandler, func() {
			executeRequest(httptest.NewRequest(http.MethodGet, "/v1/abort", nil), mux)
		})
		assert.Empty(t, logs.All())
	})

	t.Run("internalServerError emits an Error Reporting event at the call site", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		req := httptest.NewRequest(http.MethodGet, "/v1/fail", nil)
		req.Header.Set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		entries := logs.All()
		require.Len(t, entries, 2)

		errEntry := entries[0]
		assert.Equal(t, zapcore.ErrorLevel, errEntry.Level)
		assert.Equal(t, "internal error: db exploded", errEntry.Message)
		fields := fieldMap(errEntry)
		assert.Equal(t, logger.ErrorReportType, fields["@type"])
		assert.Equal(t, "projects/test-project/traces/0af7651916cd43dd8448eb211c80319c", fields[logger.TraceKey])
		_, hasStack := fields["stack_trace"]
		assert.False(t, hasStack)

		errCtx, ok := fields["context"].(logger.ErrorContext)
		require.True(t, ok)
		require.NotNil(t, errCtx.ReportLocation)
		assert.Contains(t, errCtx.ReportLocation.FilePath, "observability_test.go", "location is the handler, not errors.go")
		assert.Contains(t, errCtx.ReportLocation.FunctionName, "observedRouter")
		require.NotNil(t, errCtx.HTTPRequest)
		assert.Equal(t, 500, errCtx.HTTPRequest.ResponseStatusCode)

		assert.Equal(t, zapcore.ErrorLevel, entries[1].Level)
	})

	t.Run("successful static asset requests are not access-logged", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := observedRouter(app)

		rr := executeRequest(httptest.NewRequest(http.MethodGet, "/assets/app.js", nil), mux)
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Empty(t, logs.All())

		rr = executeRequest(httptest.NewRequest(http.MethodGet, "/assets/missing.js", nil), mux)
		checkResponseCode(t, http.StatusNotFound, rr.Code)
		require.Len(t, logs.All(), 1)
		assert.Equal(t, zapcore.WarnLevel, logs.All()[0].Level)
	})

	t.Run("4xx responses log at WARNING", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		mux := app.mount()

		rr := executeRequest(httptest.NewRequest(http.MethodGet, "/v1/health", nil), mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)

		var access *observer.LoggedEntry
		for _, e := range logs.All() {
			if e.Message == "request completed" {
				e := e
				access = &e
			}
		}
		require.NotNil(t, access)
		assert.Equal(t, zapcore.WarnLevel, access.Level)
		assert.Equal(t, "/v1/health", fieldMap(*access)["route"])
	})
}

func TestRequestLoggerFallsBackToProcessLogger(t *testing.T) {
	app, _ := newObservedApplication(t)
	assert.Same(t, app.logger, app.requestLogger(nil))
	assert.Same(t, app.logger, app.requestLogger(httptest.NewRequest(http.MethodGet, "/", nil)))
	assert.Same(t, app.logger, app.loggerFromContext(context.Background()))
}

func TestShouldLogAccess(t *testing.T) {
	mk := func(p string) *http.Request { return httptest.NewRequest(http.MethodGet, p, nil) }
	assert.True(t, shouldLogAccess(mk("/v1/health"), 200))
	assert.True(t, shouldLogAccess(mk("/auth/session/refresh"), 200))
	assert.False(t, shouldLogAccess(mk("/"), 200))
	assert.False(t, shouldLogAccess(mk("/assets/x.js"), 304))
	assert.True(t, shouldLogAccess(mk("/assets/x.js"), 404))
	assert.False(t, shouldLogAccess(mk("/v1abc"), 200), "prefix must be path-segment aware")
}

type stubPinger struct{ err error }

func (s stubPinger) PingContext(context.Context) error { return s.err }

func TestHealthCheckDatabaseProbe(t *testing.T) {
	get := func(app *application) (*httptest.ResponseRecorder, map[string]string) {
		req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
		addBasicAuth(req)
		rr := executeRequest(req, app.mount())
		var body map[string]string
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		return rr, body
	}

	t.Run("no pinger configured", func(t *testing.T) {
		app := newTestApplication(t)
		rr, body := get(app)
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "ok", body["status"])
		assert.Equal(t, "skipped", body["database"])
	})

	t.Run("database reachable", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.observability.version = "1.2.3"
		app.dbPinger = stubPinger{}
		rr, body := get(app)
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "ok", body["status"])
		assert.Equal(t, "ok", body["database"])
		assert.Equal(t, "1.2.3", body["version"])
	})

	t.Run("database unreachable returns 503", func(t *testing.T) {
		app, logs := newObservedApplication(t)
		app.dbPinger = stubPinger{err: errors.New("connection refused")}
		rr, body := get(app)
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)
		assert.Equal(t, "degraded", body["status"])
		assert.Equal(t, "unreachable", body["database"])

		var found bool
		for _, e := range logs.All() {
			if e.Message == "health check: database unreachable" {
				found = true
				assert.Equal(t, zapcore.ErrorLevel, e.Level)
			}
		}
		assert.True(t, found)
	})
}

func TestPushEndpointRedaction(t *testing.T) {
	assert.Equal(t, "fcm.googleapis.com", pushEndpointHost("https://fcm.googleapis.com/fcm/send/abc:secret"))
	assert.Equal(t, "invalid", pushEndpointHost("not a url"))
	assert.Equal(t, "invalid", pushEndpointHost(""))

	inner := errors.New("dial tcp: connection refused")
	wrapped := &url.Error{Op: "Post", URL: "https://fcm.googleapis.com/fcm/send/abc:secret", Err: inner}
	assert.Equal(t, inner, pushSendError(wrapped))
	assert.Equal(t, inner, pushSendError(inner))
}
