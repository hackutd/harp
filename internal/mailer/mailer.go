package mailer

import "embed"

const (
	FromName = "HackUTD"
)

//go:embed template/*
var FS embed.FS

type Client interface {
	SendQREmail(toEmail, toName, userID string) error
}
