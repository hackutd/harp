package mailer

import (
	"bytes"
	"fmt"
	"html/template"

	qrcode "github.com/skip2/go-qrcode"
	mail "github.com/wneessen/go-mail"
)

type SMTPMailer struct {
	fromEmail     string
	fromName      string
	hackathonName string
	client        *mail.Client
}

func NewSMTP(host string, port int, username, password, fromEmail, fromName, hackathonName string) (*SMTPMailer, error) {
	if port == 0 {
		port = 587
	}
	if fromEmail == "" {
		fromEmail = username
	}
	if hackathonName == "" {
		hackathonName = DefaultHackathonName
	}
	if fromName == "" {
		fromName = hackathonName
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
		fromEmail:     fromEmail,
		fromName:      fromName,
		hackathonName: hackathonName,
		client:        client,
	}, nil
}

func (m *SMTPMailer) SendQREmail(toEmail, toName, userID string) error {
	qrPNG, err := qrcode.Encode(userID, qrcode.Medium, 256)
	if err != nil {
		return fmt.Errorf("generating QR code: %w", err)
	}

	tmplData, err := FS.ReadFile("template/qr_email.html")
	if err != nil {
		return fmt.Errorf("reading email template: %w", err)
	}

	tmpl, err := template.New("qr_email").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing email template: %w", err)
	}

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, map[string]string{"Name": toName, "HackathonName": m.hackathonName}); err != nil {
		return fmt.Errorf("executing email template: %w", err)
	}

	msg := mail.NewMsg()
	if err := msg.FromFormat(m.fromName, m.fromEmail); err != nil {
		return fmt.Errorf("setting from address: %w", err)
	}
	if err := msg.AddToFormat(toName, toEmail); err != nil {
		return fmt.Errorf("setting to address: %w", err)
	}
	msg.Subject(fmt.Sprintf("Your %s QR Code", m.hackathonName))
	msg.SetBodyString(mail.TypeTextHTML, htmlBody.String())
	if err := msg.AttachReader("hackutd-qrcode.png", bytes.NewReader(qrPNG), mail.WithFileContentType("image/png")); err != nil {
		return fmt.Errorf("attaching QR code: %w", err)
	}

	if err := m.client.DialAndSend(msg); err != nil {
		return fmt.Errorf("sending email: %w", err)
	}

	return nil
}

func (m *SMTPMailer) SendWalkInQueuedEmail(toEmail string, position int) error {
	tmplData, err := FS.ReadFile("template/walk_in_queued.html")
	if err != nil {
		return fmt.Errorf("reading walk_in_queued template: %w", err)
	}

	tmpl, err := template.New("walk_in_queued").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing walk_in_queued template: %w", err)
	}

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, walkInQueuedData{Email: toEmail, Position: position, HackathonName: m.hackathonName}); err != nil {
		return fmt.Errorf("executing walk_in_queued template: %w", err)
	}

	msg := mail.NewMsg()
	if err := msg.FromFormat(m.fromName, m.fromEmail); err != nil {
		return fmt.Errorf("setting from address: %w", err)
	}
	if err := msg.AddToFormat(toEmail, toEmail); err != nil {
		return fmt.Errorf("setting to address: %w", err)
	}
	msg.Subject(fmt.Sprintf("You're #%d in the %s walk-in queue", position, m.hackathonName))
	msg.SetBodyString(mail.TypeTextHTML, htmlBody.String())

	if err := m.client.DialAndSend(msg); err != nil {
		return fmt.Errorf("sending walk-in queued email: %w", err)
	}

	return nil
}

func (m *SMTPMailer) SendWalkInAcceptedEmail(toEmail, userID string) error {
	qrPNG, err := qrcode.Encode(userID, qrcode.Medium, 256)
	if err != nil {
		return fmt.Errorf("generating QR code: %w", err)
	}

	tmplData, err := FS.ReadFile("template/walk_in_accepted.html")
	if err != nil {
		return fmt.Errorf("reading walk_in_accepted template: %w", err)
	}

	tmpl, err := template.New("walk_in_accepted").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing walk_in_accepted template: %w", err)
	}

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, walkInAcceptedData{Email: toEmail, HackathonName: m.hackathonName}); err != nil {
		return fmt.Errorf("executing walk_in_accepted template: %w", err)
	}

	msg := mail.NewMsg()
	if err := msg.FromFormat(m.fromName, m.fromEmail); err != nil {
		return fmt.Errorf("setting from address: %w", err)
	}
	if err := msg.AddToFormat(toEmail, toEmail); err != nil {
		return fmt.Errorf("setting to address: %w", err)
	}
	msg.Subject(fmt.Sprintf("You're in — %s Walk-In Acceptance", m.hackathonName))
	msg.SetBodyString(mail.TypeTextHTML, htmlBody.String())
	if err := msg.AttachReader("hackutd-qrcode.png", bytes.NewReader(qrPNG), mail.WithFileContentType("image/png")); err != nil {
		return fmt.Errorf("attaching QR code: %w", err)
	}

	if err := m.client.DialAndSend(msg); err != nil {
		return fmt.Errorf("sending walk-in accepted email: %w", err)
	}

	return nil
}
