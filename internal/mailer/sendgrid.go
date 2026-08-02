package mailer

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html/template"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
	qrcode "github.com/skip2/go-qrcode"
)

type walkInQueuedData struct {
	Email         string
	Position      int
	HackathonName string
}

type walkInAcceptedData struct {
	Email         string
	HackathonName string
}

type SendGridMailer struct {
	identity
	client *sendgrid.Client
}

func NewSendGrid(apiKey, fromEmail, fromName, hackathonName string) *SendGridMailer {
	return &SendGridMailer{
		identity: newIdentity(fromEmail, fromName, hackathonName),
		client:   sendgrid.NewSendClient(apiKey),
	}
}

func (m *SendGridMailer) SendQREmail(toEmail, toName, userID string) error {
	qrPNG, err := qrcode.Encode(userID, qrcode.Medium, 256)
	if err != nil {
		return fmt.Errorf("generating QR code: %w", err)
	}

	qrBase64 := base64.StdEncoding.EncodeToString(qrPNG)
	id := m.resolve()

	tmplData, err := FS.ReadFile("template/qr_email.html")
	if err != nil {
		return fmt.Errorf("reading email template: %w", err)
	}

	tmpl, err := template.New("qr_email").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing email template: %w", err)
	}

	var htmlBody bytes.Buffer
	err = tmpl.Execute(&htmlBody, map[string]string{"Name": toName, "HackathonName": id.HackathonName})
	if err != nil {
		return fmt.Errorf("executing email template: %w", err)
	}

	from := mail.NewEmail(id.FromName, id.FromEmail)
	to := mail.NewEmail(toName, toEmail)

	message := mail.NewV3Mail()
	message.SetFrom(from)
	message.Subject = fmt.Sprintf("Your %s QR Code", id.HackathonName)

	p := mail.NewPersonalization()
	p.AddTos(to)
	message.AddPersonalizations(p)

	message.AddContent(mail.NewContent("text/html", htmlBody.String()))

	attachment := mail.NewAttachment()
	attachment.SetContent(qrBase64)
	attachment.SetType("image/png")
	attachment.SetFilename("hackutd-qrcode.png")
	attachment.SetDisposition("attachment")
	message.AddAttachment(attachment)

	response, err := m.client.Send(message)
	if err != nil {
		return fmt.Errorf("sending email: %w", err)
	}
	if response.StatusCode >= 400 {
		return fmt.Errorf("sendgrid returned status %d: %s", response.StatusCode, response.Body)
	}

	return nil
}

func (m *SendGridMailer) SendWalkInQueuedEmail(toEmail string, position int) error {
	id := m.resolve()

	tmplData, err := FS.ReadFile("template/walk_in_queued.html")
	if err != nil {
		return fmt.Errorf("reading walk_in_queued template: %w", err)
	}

	tmpl, err := template.New("walk_in_queued").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing walk_in_queued template: %w", err)
	}

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, walkInQueuedData{Email: toEmail, Position: position, HackathonName: id.HackathonName}); err != nil {
		return fmt.Errorf("executing walk_in_queued template: %w", err)
	}

	from := mail.NewEmail(id.FromName, id.FromEmail)
	to := mail.NewEmail(toEmail, toEmail)

	message := mail.NewV3Mail()
	message.SetFrom(from)
	message.Subject = fmt.Sprintf("You're #%d in the %s walk-in queue", position, id.HackathonName)

	p := mail.NewPersonalization()
	p.AddTos(to)
	message.AddPersonalizations(p)
	message.AddContent(mail.NewContent("text/html", htmlBody.String()))

	response, err := m.client.Send(message)
	if err != nil {
		return fmt.Errorf("sending walk-in queued email: %w", err)
	}
	if response.StatusCode >= 400 {
		return fmt.Errorf("sendgrid returned status %d: %s", response.StatusCode, response.Body)
	}

	return nil
}

func (m *SendGridMailer) SendWalkInAcceptedEmail(toEmail, userID string) error {
	qrPNG, err := qrcode.Encode(userID, qrcode.Medium, 256)
	if err != nil {
		return fmt.Errorf("generating QR code: %w", err)
	}
	qrBase64 := base64.StdEncoding.EncodeToString(qrPNG)
	id := m.resolve()

	tmplData, err := FS.ReadFile("template/walk_in_accepted.html")
	if err != nil {
		return fmt.Errorf("reading walk_in_accepted template: %w", err)
	}

	tmpl, err := template.New("walk_in_accepted").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing walk_in_accepted template: %w", err)
	}

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, walkInAcceptedData{Email: toEmail, HackathonName: id.HackathonName}); err != nil {
		return fmt.Errorf("executing walk_in_accepted template: %w", err)
	}

	from := mail.NewEmail(id.FromName, id.FromEmail)
	to := mail.NewEmail(toEmail, toEmail)

	message := mail.NewV3Mail()
	message.SetFrom(from)
	message.Subject = fmt.Sprintf("You're in — %s Walk-In Acceptance", id.HackathonName)

	p := mail.NewPersonalization()
	p.AddTos(to)
	message.AddPersonalizations(p)
	message.AddContent(mail.NewContent("text/html", htmlBody.String()))

	attachment := mail.NewAttachment()
	attachment.SetContent(qrBase64)
	attachment.SetType("image/png")
	attachment.SetFilename("hackutd-qrcode.png")
	attachment.SetDisposition("attachment")
	message.AddAttachment(attachment)

	response, err := m.client.Send(message)
	if err != nil {
		return fmt.Errorf("sending walk-in accepted email: %w", err)
	}
	if response.StatusCode >= 400 {
		return fmt.Errorf("sendgrid returned status %d: %s", response.StatusCode, response.Body)
	}

	return nil
}
