package mailer

import (
	"bytes"
	"fmt"
	"html/template"
	"io"

	qrcode "github.com/skip2/go-qrcode"
	gomail "gopkg.in/gomail.v2"
)

type SMTPMailer struct {
	host      string
	port      int
	username  string
	password  string
	fromEmail string
	fromName  string
}

func NewSMTP(host string, port int, username, password, fromEmail, fromName string) *SMTPMailer {
	if port == 0 {
		port = 587
	}
	if fromEmail == "" {
		fromEmail = username
	}
	if fromName == "" {
		fromName = FromName
	}

	return &SMTPMailer{
		host:      host,
		port:      port,
		username:  username,
		password:  password,
		fromEmail: fromEmail,
		fromName:  fromName,
	}
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
	if err := tmpl.Execute(&htmlBody, map[string]string{"Name": toName}); err != nil {
		return fmt.Errorf("executing email template: %w", err)
	}

	msg := gomail.NewMessage()
	msg.SetAddressHeader("From", m.fromEmail, m.fromName)
	msg.SetAddressHeader("To", toEmail, toName)
	msg.SetHeader("Subject", "Your HackUTD QR Code")
	msg.SetBody("text/html", htmlBody.String())
	msg.Attach(
		"hackutd-qrcode.png",
		gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(qrPNG)
			return err
		}),
		gomail.SetHeader(map[string][]string{"Content-Type": {"image/png"}}),
	)

	dialer := gomail.NewDialer(m.host, m.port, m.username, m.password)
	if err := dialer.DialAndSend(msg); err != nil {
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
	if err := tmpl.Execute(&htmlBody, walkInQueuedData{Email: toEmail, Position: position}); err != nil {
		return fmt.Errorf("executing walk_in_queued template: %w", err)
	}

	msg := gomail.NewMessage()
	msg.SetAddressHeader("From", m.fromEmail, m.fromName)
	msg.SetAddressHeader("To", toEmail, toEmail)
	msg.SetHeader("Subject", fmt.Sprintf("You're #%d in the HackUTD walk-in queue", position))
	msg.SetBody("text/html", htmlBody.String())

	dialer := gomail.NewDialer(m.host, m.port, m.username, m.password)
	if err := dialer.DialAndSend(msg); err != nil {
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
	if err := tmpl.Execute(&htmlBody, walkInAcceptedData{Email: toEmail}); err != nil {
		return fmt.Errorf("executing walk_in_accepted template: %w", err)
	}

	msg := gomail.NewMessage()
	msg.SetAddressHeader("From", m.fromEmail, m.fromName)
	msg.SetAddressHeader("To", toEmail, toEmail)
	msg.SetHeader("Subject", "You're in — HackUTD Walk-In Acceptance")
	msg.SetBody("text/html", htmlBody.String())
	msg.Attach(
		"hackutd-qrcode.png",
		gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(qrPNG)
			return err
		}),
		gomail.SetHeader(map[string][]string{"Content-Type": {"image/png"}}),
	)

	dialer := gomail.NewDialer(m.host, m.port, m.username, m.password)
	if err := dialer.DialAndSend(msg); err != nil {
		return fmt.Errorf("sending walk-in accepted email: %w", err)
	}

	return nil
}
