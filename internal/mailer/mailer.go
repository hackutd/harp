package mailer

import "embed"

const (
	FromName = "HackUTD"
)

var FS embed.FS

type Client interface {
}
