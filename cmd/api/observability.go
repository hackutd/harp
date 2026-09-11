package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"runtime/debug"
	"strings"
	"time"

	"cloud.google.com/go/compute/metadata"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/hackutd/harp/internal/logger"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// observabilityConfig carries what Cloud Logging and Error Reporting need to
// correlate and group entries: the project owning the trace resource names
// and the deployable an error belongs to.
type observabilityConfig struct {
	projectID string
	service   string
	version   string
}

// resolveGCPProjectID prefers the explicit env var and otherwise asks the GCE
// metadata server, which Cloud Run exposes. Off GCP it returns "", and trace
// fields are simply omitted from log entries.
func resolveGCPProjectID(ctx context.Context, fromEnv string) string {
	if fromEnv != "" {
		return fromEnv
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if !metadata.OnGCEWithContext(ctx) {
		return ""
	}
	id, err := metadata.ProjectIDWithContext(ctx)
	if err != nil {
		return ""
	}
	return id
}

// resolveServiceName is the Cloud Run service (K_SERVICE) when deployed there,
// otherwise the value the operator configured.
func resolveServiceName(fromEnv string) string {
	if svc := os.Getenv("K_SERVICE"); svc != "" {
		return svc
	}
	return fromEnv
}

func (app *application) serviceContext() logger.ServiceContext {
	return logger.ServiceContext{
		Service: app.config.observability.service,
		Version: app.config.observability.version,
	}
}

const requestLoggerContextKey contextKey = "requestLogger"

// requestLogger returns the logger enriched by requestLoggingMiddleware with
// the request ID and trace fields, so every entry written while serving the
// request lines up under the Cloud Run request log in Logs Explorer. Falls
// back to the process logger outside a request.
func (app *application) requestLogger(r *http.Request) *zap.SugaredLogger {
	if r == nil {
		return app.logger
	}
	return app.loggerFromContext(r.Context())
}

// loggerFromContext is requestLogger for code that only has the request's
// context (store helpers, background work started from a handler).
func (app *application) loggerFromContext(ctx context.Context) *zap.SugaredLogger {
	if ctx != nil {
		if l, ok := ctx.Value(requestLoggerContextKey).(*zap.SugaredLogger); ok && l != nil {
			return l
		}
	}
	return app.logger
}

// requestLoggingMiddleware replaces chi's Logger and Recoverer with zap
// output. It attaches a request-scoped logger to the context, converts panics
// into a 500 plus an Error Reporting event with the stack, and writes one
// structured access-log entry per request carrying Cloud Logging's httpRequest
// payload. Successful static-asset requests are skipped: Cloud Run's own
// request log already covers them and they would dominate log volume.
func (app *application) requestLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		fields := []zap.Field{zap.String("request_id", middleware.GetReqID(r.Context()))}
		tc, hasTrace := logger.ParseTraceContext(r.Header)
		if hasTrace {
			fields = append(fields, logger.TraceFields(tc, app.config.observability.projectID)...)
		}
		reqLogger := app.logger.Desugar().With(fields...).Sugar()
		r = r.WithContext(context.WithValue(r.Context(), requestLoggerContextKey, reqLogger))

		defer func() {
			if rec := recover(); rec != nil {
				if err, ok := rec.(error); ok && errors.Is(err, http.ErrAbortHandler) {
					panic(rec)
				}
				app.logPanic(reqLogger, r, rec, debug.Stack())
				if ww.Status() == 0 {
					writeJSONError(ww, http.StatusInternalServerError, "the server encountered a problem")
				}
			}

			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}
			if !shouldLogAccess(r, status) {
				return
			}

			entry := reqLogger.Desugar().With(
				zap.Object("httpRequest", httpRequestPayload{
					r:       r,
					status:  status,
					size:    ww.BytesWritten(),
					latency: time.Since(start),
				}),
				zap.String("route", routePattern(r)),
			)
			switch {
			case status >= http.StatusInternalServerError:
				entry.Error("request completed")
			case status >= http.StatusBadRequest:
				entry.Warn("request completed")
			default:
				entry.Info("request completed")
			}
		}()

		next.ServeHTTP(ww, r)
	})
}

// shouldLogAccess keeps every API and auth request, and only failed requests
// for the SPA shell and static assets.
func shouldLogAccess(r *http.Request, status int) bool {
	p := r.URL.Path
	if strings.HasPrefix(p, "/v1/") || strings.HasPrefix(p, "/auth/") || p == "/v1" || p == "/auth" {
		return true
	}
	return status >= http.StatusBadRequest
}

// routePattern is the chi route template (e.g. /v1/admin/applications/{applicationID})
// once routing has completed; a low-cardinality key for grouping latency and
// error rates per endpoint.
func routePattern(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		return rctx.RoutePattern()
	}
	return ""
}

// httpRequestPayload renders Cloud Logging's HttpRequest proto as JSON so the
// entry gains the request summary (status, latency, method, URL) that Logs
// Explorer and log-based metrics understand natively. The query string is
// omitted so tokens never reach the logs.
// https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#httprequest
type httpRequestPayload struct {
	r       *http.Request
	status  int
	size    int
	latency time.Duration
}

func (p httpRequestPayload) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	scheme := "http"
	if p.r.TLS != nil || strings.EqualFold(p.r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	enc.AddString("requestMethod", p.r.Method)
	enc.AddString("requestUrl", scheme+"://"+p.r.Host+p.r.URL.Path)
	enc.AddInt("status", p.status)
	enc.AddString("responseSize", fmt.Sprint(p.size))
	if p.r.ContentLength > 0 {
		enc.AddString("requestSize", fmt.Sprint(p.r.ContentLength))
	}
	enc.AddString("userAgent", p.r.UserAgent())
	enc.AddString("remoteIp", clientIP(p.r))
	if ref := p.r.Referer(); ref != "" {
		enc.AddString("referer", ref)
	}
	enc.AddString("latency", fmt.Sprintf("%.9fs", p.latency.Seconds()))
	enc.AddString("protocol", p.r.Proto)
	return nil
}

// logPanic emits an entry shaped as an Error Reporting event so the panic
// shows up with its stack trace in the Error Reporting console.
func (app *application) logPanic(l *zap.SugaredLogger, r *http.Request, rec any, stack []byte) {
	errCtx := logger.ErrorContext{
		HTTPRequest: logger.HTTPRequestFromRequest(r, clientIP(r), http.StatusInternalServerError),
	}
	fields := logger.ErrorReportFields(app.serviceContext(), errCtx, stack)
	l.Desugar().With(fields...).Error(fmt.Sprintf("panic: %v", rec))
}

// callerLocation reports the file, line, and function `skip` frames above the
// caller, formatted as Error Reporting's reportLocation. It gives 500s a stable
// grouping key (the handler call site) without shipping a full stack.
func callerLocation(skip int) *logger.ReportLocation {
	pc, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return nil
	}
	loc := &logger.ReportLocation{FilePath: file, LineNumber: line}
	if fn := runtime.FuncForPC(pc); fn != nil {
		loc.FunctionName = fn.Name()
	}
	return loc
}
