package logger

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestParseTraceContext(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
		want    TraceContext
		ok      bool
	}{
		{
			name:    "traceparent sampled",
			headers: map[string]string{"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"},
			want:    TraceContext{TraceID: "0af7651916cd43dd8448eb211c80319c", SpanID: "b7ad6b7169203331", Sampled: true},
			ok:      true,
		},
		{
			name:    "traceparent not sampled",
			headers: map[string]string{"traceparent": "00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-00"},
			want:    TraceContext{TraceID: "0af7651916cd43dd8448eb211c80319c", SpanID: "b7ad6b7169203331", Sampled: false},
			ok:      true,
		},
		{
			name:    "traceparent wins over cloud trace header",
			headers: map[string]string{"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01", "X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/1;o=0"},
			want:    TraceContext{TraceID: "0af7651916cd43dd8448eb211c80319c", SpanID: "b7ad6b7169203331", Sampled: true},
			ok:      true,
		},
		{
			name:    "cloud trace header with decimal span and sampled",
			headers: map[string]string{"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/1;o=1"},
			want:    TraceContext{TraceID: "105445aa7843bc8bf206b12000100000", SpanID: "0000000000000001", Sampled: true},
			ok:      true,
		},
		{
			name:    "cloud trace header large span",
			headers: map[string]string{"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/13235353014750950193;o=0"},
			want:    TraceContext{TraceID: "105445aa7843bc8bf206b12000100000", SpanID: "b7ad6b7169203331", Sampled: false},
			ok:      true,
		},
		{
			name:    "cloud trace header trace only",
			headers: map[string]string{"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000"},
			want:    TraceContext{TraceID: "105445aa7843bc8bf206b12000100000"},
			ok:      true,
		},
		{
			name:    "cloud trace header zero span omitted",
			headers: map[string]string{"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/0;o=1"},
			want:    TraceContext{TraceID: "105445aa7843bc8bf206b12000100000", Sampled: true},
			ok:      true,
		},
		{
			name:    "malformed traceparent falls back to cloud trace header",
			headers: map[string]string{"traceparent": "garbage", "X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/1"},
			want:    TraceContext{TraceID: "105445aa7843bc8bf206b12000100000", SpanID: "0000000000000001"},
			ok:      true,
		},
		{name: "all-zero traceparent trace id rejected", headers: map[string]string{"traceparent": "00-00000000000000000000000000000000-b7ad6b7169203331-01"}},
		{name: "short cloud trace id rejected", headers: map[string]string{"X-Cloud-Trace-Context": "abc/1;o=1"}},
		{name: "non-hex cloud trace id rejected", headers: map[string]string{"X-Cloud-Trace-Context": "zz5445aa7843bc8bf206b12000100000/1"}},
		{name: "non-numeric span rejected", headers: map[string]string{"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/abc"}},
		{name: "no headers"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := http.Header{}
			for k, v := range tt.headers {
				h.Set(k, v)
			}
			got, ok := ParseTraceContext(h)
			assert.Equal(t, tt.ok, ok)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestTraceFields(t *testing.T) {
	tc := TraceContext{TraceID: "105445aa7843bc8bf206b12000100000", SpanID: "0000000000000001", Sampled: true}

	t.Run("no project id yields no fields", func(t *testing.T) {
		assert.Nil(t, TraceFields(tc, ""))
	})

	t.Run("no trace id yields no fields", func(t *testing.T) {
		assert.Nil(t, TraceFields(TraceContext{}, "my-project"))
	})

	t.Run("full resource name and span", func(t *testing.T) {
		fields := TraceFields(tc, "my-project")
		enc := zapcore.NewMapObjectEncoder()
		for _, f := range fields {
			f.AddTo(enc)
		}
		assert.Equal(t, "projects/my-project/traces/105445aa7843bc8bf206b12000100000", enc.Fields[TraceKey])
		assert.Equal(t, "0000000000000001", enc.Fields[SpanIDKey])
		assert.Equal(t, true, enc.Fields[TraceSampledKey])
	})

	t.Run("span omitted when unknown", func(t *testing.T) {
		fields := TraceFields(TraceContext{TraceID: tc.TraceID}, "my-project")
		enc := zapcore.NewMapObjectEncoder()
		for _, f := range fields {
			f.AddTo(enc)
		}
		_, hasSpan := enc.Fields[SpanIDKey]
		assert.False(t, hasSpan)
		assert.Equal(t, false, enc.Fields[TraceSampledKey])
	})
}

func TestErrorReportFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "https://harp.example.com/v1/admin/applications?token=secret", nil)
	req.Header.Set("User-Agent", "test-agent")
	req.Header.Set("Referer", "https://harp.example.com/admin")

	httpCtx := HTTPRequestFromRequest(req, "203.0.113.7", http.StatusInternalServerError)
	require.NotNil(t, httpCtx)
	assert.Equal(t, "https://harp.example.com/v1/admin/applications", httpCtx.URL, "query string must not be logged")
	assert.Equal(t, "GET", httpCtx.Method)
	assert.Equal(t, "test-agent", httpCtx.UserAgent)
	assert.Equal(t, "https://harp.example.com/admin", httpCtx.Referrer)
	assert.Equal(t, 500, httpCtx.ResponseStatusCode)
	assert.Equal(t, "203.0.113.7", httpCtx.RemoteIP)

	fields := ErrorReportFields(
		ServiceContext{Service: "harp", Version: "1.2.3"},
		ErrorContext{HTTPRequest: httpCtx, ReportLocation: &ReportLocation{FilePath: "a.go", LineNumber: 7, FunctionName: "main.f"}},
		[]byte("goroutine 1 [running]:\nmain.f()\n"),
	)
	enc := zapcore.NewMapObjectEncoder()
	for _, f := range fields {
		f.AddTo(enc)
	}
	assert.Equal(t, ErrorReportType, enc.Fields["@type"])
	assert.Equal(t, "goroutine 1 [running]:\nmain.f()\n", enc.Fields["stack_trace"])

	// serviceContext/context are zap.Any values; confirm they serialize to the
	// JSON shape Error Reporting expects.
	svc, err := json.Marshal(enc.Fields["serviceContext"])
	require.NoError(t, err)
	assert.JSONEq(t, `{"service":"harp","version":"1.2.3"}`, string(svc))

	ctx, err := json.Marshal(enc.Fields["context"])
	require.NoError(t, err)
	assert.JSONEq(t, `{
		"httpRequest":{"method":"GET","url":"https://harp.example.com/v1/admin/applications","userAgent":"test-agent","referrer":"https://harp.example.com/admin","responseStatusCode":500,"remoteIp":"203.0.113.7"},
		"reportLocation":{"filePath":"a.go","lineNumber":7,"functionName":"main.f"}
	}`, string(ctx))

	t.Run("stack omitted when empty", func(t *testing.T) {
		fields := ErrorReportFields(ServiceContext{Service: "harp"}, ErrorContext{}, nil)
		enc := zapcore.NewMapObjectEncoder()
		for _, f := range fields {
			f.AddTo(enc)
		}
		_, has := enc.Fields["stack_trace"]
		assert.False(t, has)
	})

	t.Run("nil request yields nil http context", func(t *testing.T) {
		assert.Nil(t, HTTPRequestFromRequest(nil, "", 0))
	})
}

func TestNewProductionConfig(t *testing.T) {
	cfg := NewProductionConfig()
	assert.Nil(t, cfg.Sampling, "sampling would make log-based metrics undercount")
	assert.Equal(t, "severity", cfg.EncoderConfig.LevelKey)
	assert.Equal(t, "message", cfg.EncoderConfig.MessageKey)
	assert.Equal(t, "timestamp", cfg.EncoderConfig.TimeKey)

	enc := zapcore.NewJSONEncoder(cfg.EncoderConfig)
	buf, err := enc.EncodeEntry(zapcore.Entry{Level: zapcore.WarnLevel, Message: "hi", Time: time.Now()}, []zap.Field{zap.String("k", "v")})
	require.NoError(t, err)

	var entry map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &entry))
	assert.Equal(t, "WARNING", entry["severity"])
	assert.Equal(t, "hi", entry["message"])
	assert.Equal(t, "v", entry["k"])
	_, hasTS := entry["timestamp"].(string)
	assert.True(t, hasTS, "timestamp should be an RFC3339 string")
}

func TestEncodeCloudLoggingLevel(t *testing.T) {
	cases := map[zapcore.Level]string{
		zapcore.DebugLevel:  "DEBUG",
		zapcore.InfoLevel:   "INFO",
		zapcore.WarnLevel:   "WARNING",
		zapcore.ErrorLevel:  "ERROR",
		zapcore.DPanicLevel: "CRITICAL",
		zapcore.PanicLevel:  "CRITICAL",
		zapcore.FatalLevel:  "EMERGENCY",
	}
	for lvl, want := range cases {
		arr := &sliceArrayEncoder{}
		encodeCloudLoggingLevel(lvl, arr)
		require.Len(t, arr.elems, 1)
		assert.Equal(t, want, arr.elems[0], lvl.String())
	}
}

// sliceArrayEncoder is the minimal PrimitiveArrayEncoder needed to observe
// what encodeCloudLoggingLevel appends.
type sliceArrayEncoder struct {
	elems []any
}

func (s *sliceArrayEncoder) AppendBool(v bool)             { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendByteString(v []byte)     { s.elems = append(s.elems, string(v)) }
func (s *sliceArrayEncoder) AppendComplex128(v complex128) { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendComplex64(v complex64)   { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendFloat64(v float64)       { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendFloat32(v float32)       { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendInt(v int)               { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendInt64(v int64)           { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendInt32(v int32)           { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendInt16(v int16)           { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendInt8(v int8)             { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendString(v string)         { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUint(v uint)             { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUint64(v uint64)         { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUint32(v uint32)         { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUint16(v uint16)         { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUint8(v uint8)           { s.elems = append(s.elems, v) }
func (s *sliceArrayEncoder) AppendUintptr(v uintptr)       { s.elems = append(s.elems, v) }
