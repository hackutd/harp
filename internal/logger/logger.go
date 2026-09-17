// Package logger builds the process-wide zap logger and provides the small
// helpers needed to make its output first-class in Google Cloud Logging:
// severity mapping, trace correlation, and Error Reporting payloads.
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(env string) *zap.SugaredLogger {
	var l *zap.Logger
	// Dev human readable
	if env == "development" {
		l = zap.Must(zap.NewDevelopment())
	} else {
		l = zap.Must(NewProductionConfig().Build())
	}
	return l.Sugar()
}

// NewProductionConfig returns a JSON config whose special keys Cloud Logging
// lifts out of jsonPayload into the LogEntry itself (severity, message,
// timestamp). Sampling is disabled so log-based metrics and Error Reporting
// counts reflect real volumes rather than zap's per-second sample.
func NewProductionConfig() zap.Config {
	cfg := zap.NewProductionConfig()
	cfg.Sampling = nil
	cfg.EncoderConfig.LevelKey = "severity"
	cfg.EncoderConfig.MessageKey = "message"
	cfg.EncoderConfig.TimeKey = "timestamp"
	cfg.EncoderConfig.EncodeTime = zapcore.RFC3339NanoTimeEncoder
	cfg.EncoderConfig.EncodeLevel = encodeCloudLoggingLevel
	return cfg
}

func encodeCloudLoggingLevel(l zapcore.Level, enc zapcore.PrimitiveArrayEncoder) {
	switch l {
	case zapcore.DebugLevel:
		enc.AppendString("DEBUG")
	case zapcore.InfoLevel:
		enc.AppendString("INFO")
	case zapcore.WarnLevel:
		enc.AppendString("WARNING")
	case zapcore.ErrorLevel:
		enc.AppendString("ERROR")
	case zapcore.DPanicLevel, zapcore.PanicLevel:
		enc.AppendString("CRITICAL")
	case zapcore.FatalLevel:
		enc.AppendString("EMERGENCY")
	default:
		enc.AppendString("DEFAULT")
	}
}
