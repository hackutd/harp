package mailer

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

type walkInQueuedData struct {
	Email         string
	Position      int
	HackathonName string
	From          string
}

type walkInAcceptedData struct {
	Email         string
	HackathonName string
	From          string
}

type qrEmailData struct {
	Name          string
	HackathonName string
	From          string
}

type SendGridMailer struct {
	identity
	portalURL string
	client    *sendgrid.Client
}

func NewSendGrid(apiKey, fromEmail, fromName, hackathonName, portalURL string) *SendGridMailer {
	return &SendGridMailer{
		identity:  newIdentity(fromEmail, fromName, hackathonName),
		portalURL: portalURL,
		client:    sendgrid.NewSendClient(apiKey),
	}
}

// send delivers a rendered HTML email to a single recipient. The Zero Day
// title image every template references by Content-ID is embedded inline;
// any further attachments are delivered as regular downloads.
func (m *SendGridMailer) send(id Identity, toEmail, toName, subject, htmlBody string, attachments ...attachment) error {
	brandImage, err := loadBrandImage()
	if err != nil {
		return err
	}

	message := mail.NewV3Mail()
	message.SetFrom(mail.NewEmail(id.FromName, id.FromEmail))
	message.Subject = subject

	p := mail.NewPersonalization()
	p.AddTos(mail.NewEmail(toName, toEmail))
	message.AddPersonalizations(p)
	message.AddContent(mail.NewContent("text/html", htmlBody))

	brand := mail.NewAttachment()
	brand.SetContent(base64.StdEncoding.EncodeToString(brandImage))
	brand.SetType(brandImageContentType)
	brand.SetFilename(brandImageContentID)
	brand.SetDisposition("inline")
	brand.SetContentID(brandImageContentID)
	message.AddAttachment(brand)

	for _, a := range attachments {
		file := mail.NewAttachment()
		file.SetContent(base64.StdEncoding.EncodeToString(a.Content))
		file.SetType(a.ContentType)
		file.SetFilename(a.Filename)
		file.SetDisposition("attachment")
		message.AddAttachment(file)
	}

	response, err := m.client.Send(message)
	if err != nil {
		return fmt.Errorf("sending email: %w", err)
	}
	if response.StatusCode >= 400 {
		return fmt.Errorf("sendgrid returned status %d: %s", response.StatusCode, response.Body)
	}

	return nil
}

func (m *SendGridMailer) SendMagicLinkEmail(toEmail, magicLink string, codeLifetime time.Duration) error {
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

func (m *SendGridMailer) SendDecisionEmail(toEmail, toName string, decision Decision) error {
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

func (m *SendGridMailer) SendDecisionsReleasedEmail(toEmail, toName string) error {
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

func (m *SendGridMailer) SendQREmail(toEmail, toName, userID string) error {
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

func (m *SendGridMailer) SendWalkInQueuedEmail(toEmail string, position int) error {
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

func (m *SendGridMailer) SendWalkInAcceptedEmail(toEmail, userID string) error {
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
