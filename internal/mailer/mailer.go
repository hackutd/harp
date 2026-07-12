package mailer

import (
	"embed"
	"fmt"
)

const (
	// DefaultHackathonName is the fallback event name used in email subjects
	// and bodies when HACKATHON_NAME is unset.
	DefaultHackathonName = "Hackathon"
)

//go:embed template/*
var FS embed.FS

type Client interface {
	SendQREmail(toEmail, toName, userID string) error
	SendWalkInQueuedEmail(toEmail string, position int) error
	SendWalkInAcceptedEmail(toEmail, userID string) error
}

type Config struct {
	FromEmail     string
	FromName      string
	HackathonName string
	SendGrid      SendGridConfig
	SMTP          SMTPConfig
}

type SendGridConfig struct {
	APIKey string
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
}

// New selects a mailer provider based on cfg: SMTP when EMAIL_HOST is set,
// otherwise SendGrid when SENDGRID_API_KEY is set. At least one is required.
func New(cfg Config) (Client, error) {
	switch {
	case cfg.SMTP.Host != "":
		if cfg.SMTP.Username == "" || cfg.SMTP.Password == "" {
			return nil, fmt.Errorf("EMAIL_HOST is set but EMAIL_USERNAME and EMAIL_PASSWORD are required for SMTP")
		}
		return NewSMTP(
			cfg.SMTP.Host,
			cfg.SMTP.Port,
			cfg.SMTP.Username,
			cfg.SMTP.Password,
			cfg.FromEmail,
			cfg.FromName,
			cfg.HackathonName,
		)
	case cfg.SendGrid.APIKey != "":
		return NewSendGrid(cfg.SendGrid.APIKey, cfg.FromEmail, cfg.FromName, cfg.HackathonName), nil
	default:
		return nil, fmt.Errorf("no mailer configured: set SMTP (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD) or SENDGRID_API_KEY")
	}
}
