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
		// Prod for Google Cloud Logging
		cfg := zap.NewProductionConfig()
		cfg.EncoderConfig.LevelKey = "severity"
		cfg.EncoderConfig.MessageKey = "message"
		cfg.EncoderConfig.TimeKey = "timestamp"
		cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		cfg.EncoderConfig.EncodeLevel = encodeCloudLoggingLevel
		l = zap.Must(cfg.Build())
	}
	return l.Sugar()
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
