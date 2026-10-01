package mailer

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestRenderPreviews writes each template to $EMAIL_PREVIEW_DIR for manual
// inspection. Skipped unless the env var is set.
func TestRenderPreviews(t *testing.T) {
	dir := os.Getenv("EMAIL_PREVIEW_DIR")
	if dir == "" {
		t.Skip("EMAIL_PREVIEW_DIR not set")
	}
	image, err := loadBrandImage()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, brandImageContentID), image, 0o644); err != nil {
		t.Fatal(err)
	}

	decision := decisionEmailData{Name: "Ada", HackathonName: "HackUTD 2026", PortalURL: "https://portal.test", From: "HackUTD"}
	templates := map[string]any{
		"magic_link":          magicLinkEmailData{Email: "hacker@example.com", MagicLink: "https://portal.test/auth/verify?token=abc123", Expires: "15 minutes", HackathonName: "HackUTD 2026", From: "HackUTD"},
		"decision_accepted":   decision,
		"decision_waitlisted": decision,
		"decision_rejected":   decision,
		"decisions_released":  decision,
		"qr_email":            qrEmailData{Name: "Ada", HackathonName: "HackUTD 2026", From: "HackUTD"},
		"walk_in_queued":      walkInQueuedData{Email: "hacker@example.com", Position: 7, HackathonName: "HackUTD 2026", From: "HackUTD"},
		"walk_in_accepted":    walkInAcceptedData{Email: "hacker@example.com", HackathonName: "HackUTD 2026", From: "HackUTD"},
	}
	for name, data := range templates {
		out, err := renderTemplate(name, data)
		if err != nil {
			t.Fatal(err)
		}
		out = strings.ReplaceAll(out, "cid:"+brandImageContentID, brandImageContentID)
		if err := os.WriteFile(filepath.Join(dir, name+".html"), []byte(out), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
