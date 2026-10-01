package mailer

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"os"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	"github.com/hackutd/harp/internal/slug"
)

const (
	// DefaultHackathonName is the fallback event name used in email subjects
	// and bodies when HACKATHON_NAME is unset.
	DefaultHackathonName = "Hackathon"

	// defaultQRAttachmentFilename is used when the configured event name has no
	// ASCII characters to build a filename from.
	defaultQRAttachmentFilename = "qr-code.png"

	// brandImageContentID is the Content-ID every template references as
	// cid:zero-day-title.webp. The image is embedded inline on every send so
	// the header renders without the client having to fetch a remote asset.
	brandImageContentID   = "zero-day-title.webp"
	brandImageContentType = "image/webp"
)

// brandImagePaths are tried in order: the production container ships the
// asset under static/, while local dev and tests read it from the portal
// source tree (from the repo root or from within this package).
var brandImagePaths = []string{
	"static/email-assets/zero-day-title.webp",
	"client/portal/src/assets/title-login.webp",
	"../../client/portal/src/assets/title-login.webp",
}

// attachment is a provider-agnostic file to attach to an outgoing email.
type attachment struct {
	Filename    string
	ContentType string
	Content     []byte
}

// qrAttachment renders the hacker's check-in QR code as a PNG attachment
// named after the configured event.
func qrAttachment(hackathonName, userID string) (attachment, error) {
	png, err := qrcode.Encode(userID, qrcode.Medium, 256)
	if err != nil {
		return attachment{}, fmt.Errorf("generating QR code: %w", err)
	}
	return attachment{Filename: qrAttachmentFilename(hackathonName), ContentType: "image/png", Content: png}, nil
}

// qrAttachmentFilename names the attached QR image after the configured event,
// so a hacker saves smu-hacks-2027-qr-code.png rather than a file named after
// whoever happens to run the upstream project.
//
// Mail clients handle non-ASCII attachment names inconsistently, so the slug is
// reduced to ASCII the same way download filenames are.
func qrAttachmentFilename(hackathonName string) string {
	name := slug.ASCII(slug.Hackathon(hackathonName))
	if name == "" || name == slug.UnconfiguredHackathon {
		return defaultQRAttachmentFilename
	}
	return name + "-qr-code.png"
}

//go:embed template/*
var FS embed.FS

// Decision is the outcome communicated by a decision email. It mirrors the
// decided application statuses without importing the store package.
type Decision string

const (
	DecisionAccepted   Decision = "accepted"
	DecisionWaitlisted Decision = "waitlisted"
	DecisionRejected   Decision = "rejected"
)

type Client interface {
	SendMagicLinkEmail(toEmail, magicLink string, codeLifetime time.Duration) error
	SendQREmail(toEmail, toName, userID string) error
	SendWalkInQueuedEmail(toEmail string, position int) error
	SendWalkInAcceptedEmail(toEmail, userID string) error
	SendDecisionEmail(toEmail, toName string, decision Decision) error
	SendDecisionsReleasedEmail(toEmail, toName string) error
	// SetIdentityResolver installs a resolver consulted on every send so the
	// hackathon name and sender identity can come from runtime settings
	// instead of the env vars used at boot.
	SetIdentityResolver(fn IdentityFunc)
}

type magicLinkEmailData struct {
	Email         string
	MagicLink     string
	Expires       string
	HackathonName string
	From          string
}

func loadBrandImage() ([]byte, error) {
	var lastErr error
	for _, path := range brandImagePaths {
		image, err := os.ReadFile(path)
		if err == nil {
			return image, nil
		}
		lastErr = err
	}
	return nil, fmt.Errorf("reading Zero Day email title image: %w", lastErr)
}

func magicLinkLifetime(duration time.Duration) string {
	minutes := int(duration.Round(time.Minute) / time.Minute)
	if minutes <= 0 {
		return "a short time"
	}
	if minutes == 1 {
		return "1 minute"
	}
	if minutes%60 == 0 {
		hours := minutes / 60
		if hours == 1 {
			return "1 hour"
		}
		return fmt.Sprintf("%d hours", hours)
	}
	return fmt.Sprintf("%d minutes", minutes)
}

// Identity is the sender identity and event name used in outgoing email.
type Identity struct {
	FromEmail     string
	FromName      string
	HackathonName string
}

// IdentityFunc resolves the identity at send time. Empty fields fall back to
// the env-configured defaults.
type IdentityFunc func() Identity

type identity struct {
	defaults Identity
	resolver IdentityFunc
}

func newIdentity(fromEmail, fromName, hackathonName string) identity {
	if hackathonName == "" {
		hackathonName = DefaultHackathonName
	}
	if fromName == "" {
		fromName = hackathonName
	}
	return identity{defaults: Identity{FromEmail: fromEmail, FromName: fromName, HackathonName: hackathonName}}
}

func (i *identity) SetIdentityResolver(fn IdentityFunc) {
	i.resolver = fn
}

func (i *identity) resolve() Identity {
	out := i.defaults
	if i.resolver == nil {
		return out
	}

	override := i.resolver()
	if override.HackathonName != "" {
		out.HackathonName = override.HackathonName
	}
	if override.FromEmail != "" {
		out.FromEmail = override.FromEmail
	}
	if override.FromName != "" {
		out.FromName = override.FromName
	}

	return out
}

type Config struct {
	FromEmail     string
	FromName      string
	HackathonName string
	PortalURL     string
	SendGrid      SendGridConfig
	SMTP          SMTPConfig
}

// decisionEmailData is the template context for the decision and
// decisions-released emails. From is the sender name (EMAIL_FROM_NAME, falling
// back to the hackathon name) so the signature reflects who is actually
// sending the email rather than a hardcoded label.
type decisionEmailData struct {
	Name          string
	HackathonName string
	PortalURL     string
	From          string
}

// decisionTemplate maps a decision to its template file (without the .html
// suffix) and subject format string. The format string takes the hackathon
// name. An unknown decision is an error, never silently send the wrong email.
func decisionTemplate(decision Decision) (name, subjectFormat string, err error) {
	switch decision {
	case DecisionAccepted:
		return "decision_accepted", "Welcome to %s", nil
	case DecisionWaitlisted:
		return "decision_waitlisted", "You're on the %s waitlist", nil
	case DecisionRejected:
		return "decision_rejected", "Your %s application", nil
	}
	return "", "", fmt.Errorf("unknown decision: %q", decision)
}

// renderTemplate reads, parses, and executes an embedded email template.
func renderTemplate(name string, data any) (string, error) {
	raw, err := FS.ReadFile("template/" + name + ".html")
	if err != nil {
		return "", fmt.Errorf("reading %s template: %w", name, err)
	}

	tmpl, err := template.New(name).Parse(string(raw))
	if err != nil {
		return "", fmt.Errorf("parsing %s template: %w", name, err)
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return "", fmt.Errorf("executing %s template: %w", name, err)
	}

	return body.String(), nil
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
			cfg.PortalURL,
		)
	case cfg.SendGrid.APIKey != "":
		return NewSendGrid(cfg.SendGrid.APIKey, cfg.FromEmail, cfg.FromName, cfg.HackathonName, cfg.PortalURL), nil
	default:
		return nil, fmt.Errorf("no mailer configured: set SMTP (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD) or SENDGRID_API_KEY")
	}
}
