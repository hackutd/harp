package logger

import (
	"net/http"
	"strconv"
	"strings"

	"go.uber.org/zap"
)

// Special jsonPayload keys that Cloud Logging promotes onto the LogEntry.
// https://cloud.google.com/logging/docs/structured-logging
const (
	TraceKey        = "logging.googleapis.com/trace"
	SpanIDKey       = "logging.googleapis.com/spanId"
	TraceSampledKey = "logging.googleapis.com/trace_sampled"

	// ErrorReportType forces Error Reporting to ingest an entry even when it
	// carries no parseable stack trace.
	// https://cloud.google.com/error-reporting/docs/formatting-error-messages
	ErrorReportType = "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent"
)

// TraceContext is the trace identity of an inbound request.
type TraceContext struct {
	TraceID string
	SpanID  string
	Sampled bool
}

// ParseTraceContext reads the W3C traceparent header, falling back to the
// legacy X-Cloud-Trace-Context header that Google's front end sets on every
// request into Cloud Run. Returns false when neither is present or parseable.
func ParseTraceContext(h http.Header) (TraceContext, bool) {
	if tc, ok := parseTraceparent(h.Get("traceparent")); ok {
		return tc, true
	}
	return parseCloudTraceContext(h.Get("X-Cloud-Trace-Context"))
}

// traceparent: version-traceid-spanid-flags, e.g.
// 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
func parseTraceparent(v string) (TraceContext, bool) {
	parts := strings.Split(strings.TrimSpace(v), "-")
	if len(parts) < 4 || len(parts[1]) != 32 || len(parts[2]) != 16 || len(parts[3]) != 2 {
		return TraceContext{}, false
	}
	if !isHex(parts[1]) || !isHex(parts[2]) || !isHex(parts[3]) {
		return TraceContext{}, false
	}
	if parts[1] == strings.Repeat("0", 32) || parts[2] == strings.Repeat("0", 16) {
		return TraceContext{}, false
	}
	flags, err := strconv.ParseUint(parts[3], 16, 8)
	if err != nil {
		return TraceContext{}, false
	}
	return TraceContext{
		TraceID: strings.ToLower(parts[1]),
		SpanID:  strings.ToLower(parts[2]),
		Sampled: flags&0x01 == 1,
	}, true
}

// X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=TRACE_TRUE, where SPAN_ID is a
// decimal uint64 and the ;o= suffix is optional.
func parseCloudTraceContext(v string) (TraceContext, bool) {
	v = strings.TrimSpace(v)
	if v == "" {
		return TraceContext{}, false
	}

	var tc TraceContext
	rest := v
	if i := strings.IndexByte(rest, ';'); i >= 0 {
		tc.Sampled = strings.HasPrefix(rest[i+1:], "o=1")
		rest = rest[:i]
	}

	traceID, spanDec, hasSpan := strings.Cut(rest, "/")
	if len(traceID) != 32 || !isHex(traceID) {
		return TraceContext{}, false
	}
	tc.TraceID = strings.ToLower(traceID)

	if hasSpan && spanDec != "" {
		span, err := strconv.ParseUint(spanDec, 10, 64)
		if err != nil {
			return TraceContext{}, false
		}
		if span != 0 {
			tc.SpanID = strconv.FormatUint(span, 16)
			tc.SpanID = strings.Repeat("0", 16-len(tc.SpanID)) + tc.SpanID
		}
	}
	return tc, true
}

func isHex(s string) bool {
	for _, c := range s {
		switch {
		case c >= '0' && c <= '9', c >= 'a' && c <= 'f', c >= 'A' && c <= 'F':
		default:
			return false
		}
	}
	return len(s) > 0
}

// TraceFields returns the fields that let Logs Explorer nest an entry under
// the Cloud Run request log for the same trace. The trace resource name needs
// the project ID; with none known the fields are omitted.
func TraceFields(tc TraceContext, projectID string) []zap.Field {
	if projectID == "" || tc.TraceID == "" {
		return nil
	}
	fields := []zap.Field{
		zap.String(TraceKey, "projects/"+projectID+"/traces/"+tc.TraceID),
		zap.Bool(TraceSampledKey, tc.Sampled),
	}
	if tc.SpanID != "" {
		fields = append(fields, zap.String(SpanIDKey, tc.SpanID))
	}
	return fields
}

// ServiceContext identifies the deployable in Error Reporting.
type ServiceContext struct {
	Service string `json:"service"`
	Version string `json:"version,omitempty"`
}

// ReportLocation is the code location Error Reporting groups on when an
// entry carries no stack trace.
type ReportLocation struct {
	FilePath     string `json:"filePath"`
	LineNumber   int    `json:"lineNumber"`
	FunctionName string `json:"functionName"`
}

// HTTPRequestContext is the request summary shown alongside an error event.
type HTTPRequestContext struct {
	Method             string `json:"method,omitempty"`
	URL                string `json:"url,omitempty"`
	UserAgent          string `json:"userAgent,omitempty"`
	Referrer           string `json:"referrer,omitempty"`
	ResponseStatusCode int    `json:"responseStatusCode,omitempty"`
	RemoteIP           string `json:"remoteIp,omitempty"`
}

// ErrorContext is the "context" member of a ReportedErrorEvent.
type ErrorContext struct {
	HTTPRequest    *HTTPRequestContext `json:"httpRequest,omitempty"`
	User           string              `json:"user,omitempty"`
	ReportLocation *ReportLocation     `json:"reportLocation,omitempty"`
}

// ErrorReportFields shapes an entry as a ReportedErrorEvent so Error
// Reporting captures and groups it. Pass a stack (runtime/debug.Stack output)
// when one is available; grouping then follows the stack instead of the
// location.
func ErrorReportFields(svc ServiceContext, ctx ErrorContext, stack []byte) []zap.Field {
	fields := []zap.Field{
		zap.String("@type", ErrorReportType),
		zap.Any("serviceContext", svc),
		zap.Any("context", ctx),
	}
	if len(stack) > 0 {
		fields = append(fields, zap.ByteString("stack_trace", stack))
	}
	return fields
}

// HTTPRequestFromRequest fills the Error Reporting request summary from an
// inbound request. The query string is dropped so tokens never land in logs.
// remoteIP is passed in because the trustworthy client address depends on the
// proxy configuration, not r.RemoteAddr alone.
func HTTPRequestFromRequest(r *http.Request, remoteIP string, status int) *HTTPRequestContext {
	if r == nil {
		return nil
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return &HTTPRequestContext{
		Method:             r.Method,
		URL:                scheme + "://" + r.Host + r.URL.Path,
		UserAgent:          r.UserAgent(),
		Referrer:           r.Referer(),
		ResponseStatusCode: status,
		RemoteIP:           remoteIP,
	}
}
