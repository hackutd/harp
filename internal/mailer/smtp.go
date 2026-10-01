package mailer

import (
	"bytes"
	"fmt"
	"time"

	mail "github.com/wneessen/go-mail"
)

type SMTPMailer struct {
	identity
	portalURL string
	client    *mail.Client
}

func NewSMTP(host string, port int, username, password, fromEmail, fromName, hackathonName, portalURL string) (*SMTPMailer, error) {
	if port == 0 {
		port = 587
	}
	if fromEmail == "" {
		fromEmail = username
	}

	// TLSMandatory covers real providers: STARTTLS on 587, implicit TLS on 465.
	// A plaintext local catcher (e.g. Mailpit) would need TLSOpportunistic instead.
	client, err := mail.NewClient(host,
		mail.WithPort(port),
		mail.WithSMTPAuth(mail.SMTPAuthAutoDiscover),
		mail.WithUsername(username),
		mail.WithPassword(password),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
	)
	if err != nil {
		return nil, fmt.Errorf("creating SMTP client: %w", err)
	}

	return &SMTPMailer{
		identity:  newIdentity(fromEmail, fromName, hackathonName),
		portalURL: portalURL,
		client:    client,
	}, nil
}

// send delivers a rendered HTML email to a single recipient. The Zero Day
// title image every template references by Content-ID is embedded inline;
// any further attachments are delivered as regular downloads.
func (m *SMTPMailer) send(id Identity, toEmail, toName, subject, htmlBody string, attachments ...attachment) error {
	brandImage, err := loadBrandImage()
	if err != nil {
		return err
	}

	msg := mail.NewMsg()
	if err := msg.FromFormat(id.FromName, id.FromEmail); err != nil {
		return fmt.Errorf("setting from address: %w", err)
	}
	if err := msg.AddToFormat(toName, toEmail); err != nil {
		return fmt.Errorf("setting to address: %w", err)
	}
	msg.Subject(subject)
	msg.SetBodyString(mail.TypeTextHTML, htmlBody)

	if err := msg.EmbedReader(brandImageContentID, bytes.NewReader(brandImage), mail.WithFileContentType(brandImageContentType)); err != nil {
		return fmt.Errorf("embedding Zero Day email title image: %w", err)
	}
	for _, a := range attachments {
		if err := msg.AttachReader(a.Filename, bytes.NewReader(a.Content), mail.WithFileContentType(mail.ContentType(a.ContentType))); err != nil {
			return fmt.Errorf("attaching %s: %w", a.Filename, err)
		}
	}

	if err := m.client.DialAndSend(msg); err != nil {
		return fmt.Errorf("sending email: %w", err)
	}

	return nil
}

func (m *SMTPMailer) SendMagicLinkEmail(toEmail, magicLink string, codeLifetime time.Duration) error {
	id := m.resolve()
	htmlBody, err := renderTemplate("magic_link", magicLinkEmailData{
		Email:         toEmail,
		MagicLink:     magicLink,
		Expires:       magicLinkLifetime(codeLifetime),
		HackathonName: id.HackathonName,
		From:          id.FromName,
	})
	if err != nil {
		return err
	}

	return m.send(id, toEmail, toEmail, "Your Zero Day access link", htmlBody)
}

func (m *SMTPMailer) SendDecisionEmail(toEmail, toName string, decision Decision) error {
	tmplName, subjectFormat, err := decisionTemplate(decision)
	if err != nil {
		return err
	}
	id := m.resolve()

	htmlBody, err := renderTemplate(tmplName, decisionEmailData{
		Name:          toName,
		HackathonName: id.HackathonName,
		PortalURL:     m.portalURL,
		From:          id.FromName,
	})
	if err != nil {
		return err
	}

	return m.send(id, toEmail, toName, fmt.Sprintf(subjectFormat, id.HackathonName), htmlBody)
}

func (m *SMTPMailer) SendDecisionsReleasedEmail(toEmail, toName string) error {
	id := m.resolve()
	htmlBody, err := renderTemplate("decisions_released", decisionEmailData{
		Name:          toName,
		HackathonName: id.HackathonName,
		PortalURL:     m.portalURL,
		From:          id.FromName,
	})
	if err != nil {
		return err
	}

	return m.send(id, toEmail, toName, fmt.Sprintf("%s decisions are out", id.HackathonName), htmlBody)
}

func (m *SMTPMailer) SendQREmail(toEmail, toName, userID string) error {
	id := m.resolve()
	qr, err := qrAttachment(id.HackathonName, userID)
	if err != nil {
		return err
	}

	htmlBody, err := renderTemplate("qr_email", qrEmailData{Name: toName, HackathonName: id.HackathonName, From: id.FromName})
	if err != nil {
		return err
	}

	return m.send(id, toEmail, toName, fmt.Sprintf("Your %s QR code", id.HackathonName), htmlBody, qr)
}

func (m *SMTPMailer) SendWalkInQueuedEmail(toEmail string, position int) error {
	id := m.resolve()
	htmlBody, err := renderTemplate("walk_in_queued", walkInQueuedData{Email: toEmail, Position: position, HackathonName: id.HackathonName, From: id.FromName})
	if err != nil {
		return err
	}

	subject := fmt.Sprintf("You're #%d in the %s walk-in queue", position, id.HackathonName)
	if err := m.send(id, toEmail, toEmail, subject, htmlBody); err != nil {
		return fmt.Errorf("sending walk-in queued email: %w", err)
	}
	return nil
}

func (m *SMTPMailer) SendWalkInAcceptedEmail(toEmail, userID string) error {
	id := m.resolve()
	qr, err := qrAttachment(id.HackathonName, userID)
	if err != nil {
		return err
	}

	htmlBody, err := renderTemplate("walk_in_accepted", walkInAcceptedData{Email: toEmail, HackathonName: id.HackathonName, From: id.FromName})
	if err != nil {
		return err
	}

	if err := m.send(id, toEmail, toEmail, fmt.Sprintf("You're in for %s", id.HackathonName), htmlBody, qr); err != nil {
		return fmt.Errorf("sending walk-in accepted email: %w", err)
	}
	return nil
}
