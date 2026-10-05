package mailer

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestMagicLinkTemplateRenders(t *testing.T) {
	data := magicLinkEmailData{
		Email:         "hacker@example.com",
		MagicLink:     "https://portal.test/auth/verify?token=abc123",
		Expires:       "15 minutes",
		HackathonName: "HackUTD 2026",
		From:          "HackUTD",
	}
	out, err := renderTemplate("magic_link", data)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"Zero Day",
		"hacker@example.com",
		"https://portal.test/auth/verify?token=abc123",
		"cid:" + brandImageContentID,
		"15 minutes",
		"HackUTD 2026",
		"hello@hackutd.co",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("magic_link: missing %q", want)
		}
	}
	if strings.Contains(out, "<no value>") || strings.Contains(out, "{{") {
		t.Error("magic_link: unresolved placeholder")
	}
}

func TestBrandImageEmbedded(t *testing.T) {
	if len(brandImage) == 0 {
		t.Fatal("email banner is empty")
	}
	if got := http.DetectContentType(brandImage); got != brandImageContentType {
		t.Fatalf("email banner is %s, attached as %s", got, brandImageContentType)
	}
}

// Every template renders inside the shared frame in layout.html: the inline
// banner, the red rule beneath it, the signature, and the contact footer. The
// banner is attached by Content-ID on every send, so a template that loses it
// renders a dangling attachment instead of the header. The light-only
// color-scheme declaration is what keeps inversion-aware clients from
// repainting the white page, so it is asserted alongside the frame.
func TestAllTemplatesShareFrame(t *testing.T) {
	decision := decisionEmailData{Name: "Ada", HackathonName: "HackUTD 2026", PortalURL: "https://portal.test", From: "HackUTD"}
	templates := map[string]any{
		"magic_link": magicLinkEmailData{
			Email: "hacker@example.com", MagicLink: "https://portal.test/auth/verify?token=abc123",
			Expires: "15 minutes", HackathonName: "HackUTD 2026", From: "HackUTD",
		},
		"decision_accepted":   decision,
		"decision_waitlisted": decision,
		"decision_rejected":   decision,
		"decisions_released":  decision,
		"qr_email":            qrEmailData{Name: "Ada", HackathonName: "HackUTD 2026", From: "HackUTD"},
		"walk_in_queued":      walkInQueuedData{Email: "hacker@example.com", Position: 7, HackathonName: "HackUTD 2026", From: "HackUTD"},
		"walk_in_accepted":    walkInAcceptedData{Email: "hacker@example.com", HackathonName: "HackUTD 2026", From: "HackUTD"},
	}

	for name, data := range templates {
		t.Run(name, func(t *testing.T) {
			out, err := renderTemplate(name, data)
			if err != nil {
				t.Fatal(err)
			}
			for _, want := range []string{
				"cid:" + brandImageContentID,
				`bgcolor="#D63B4F"`,
				`<meta name="color-scheme" content="light only" />`,
				`<meta name="supported-color-schemes" content="light only" />`,
				"HackUTD 2026",
				"Best,",
				"hello@hackutd.co",
			} {
				if !strings.Contains(out, want) {
					t.Errorf("%s: missing %q", name, want)
				}
			}
			if strings.Contains(out, "<no value>") || strings.Contains(out, "{{") {
				t.Errorf("%s: unresolved placeholder", name)
			}
		})
	}
}

func TestEventTemplatesRender(t *testing.T) {
	t.Run("qr_email", func(t *testing.T) {
		out, err := renderTemplate("qr_email", qrEmailData{Name: "Ada", HackathonName: "HackUTD", From: "HackUTD"})
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{"Ada", "attached"} {
			if !strings.Contains(out, want) {
				t.Errorf("qr_email: missing %q", want)
			}
		}
	})

	t.Run("walk_in_queued", func(t *testing.T) {
		out, err := renderTemplate("walk_in_queued", walkInQueuedData{Email: "hacker@example.com", Position: 7, HackathonName: "HackUTD", From: "HackUTD"})
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{"hacker@example.com", "#7", "10 minutes"} {
			if !strings.Contains(out, want) {
				t.Errorf("walk_in_queued: missing %q", want)
			}
		}
	})

	t.Run("walk_in_accepted", func(t *testing.T) {
		out, err := renderTemplate("walk_in_accepted", walkInAcceptedData{Email: "hacker@example.com", HackathonName: "HackUTD", From: "HackUTD"})
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{"hacker@example.com", "10 minutes", "attached"} {
			if !strings.Contains(out, want) {
				t.Errorf("walk_in_accepted: missing %q", want)
			}
		}
	})
}

func TestMagicLinkLifetime(t *testing.T) {
	tests := map[time.Duration]string{
		0:                "a short time",
		time.Minute:      "1 minute",
		15 * time.Minute: "15 minutes",
		time.Hour:        "1 hour",
		2 * time.Hour:    "2 hours",
	}
	for duration, want := range tests {
		if got := magicLinkLifetime(duration); got != want {
			t.Errorf("magicLinkLifetime(%s) = %q, want %q", duration, got, want)
		}
	}
}

func TestDecisionTemplatesRender(t *testing.T) {
	data := decisionEmailData{Name: "Ada", HackathonName: "HackUTD", PortalURL: "https://portal.test", From: "HackUTD"}
	for _, name := range []string{"decision_accepted", "decision_waitlisted", "decision_rejected", "decisions_released"} {
		out, err := renderTemplate(name, data)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for _, want := range []string{"Ada", "HackUTD"} {
			if !strings.Contains(out, want) {
				t.Errorf("%s: missing %q", name, want)
			}
		}
		if strings.Contains(out, "<no value>") || strings.Contains(out, "{{") {
			t.Errorf("%s: unresolved placeholder", name)
		}
	}
	// The announcement must never leak an outcome.
	out, _ := renderTemplate("decisions_released", data)
	for _, banned := range []string{"accepted", "rejected", "waitlist", "Congratulations"} {
		if strings.Contains(strings.ToLower(out), strings.ToLower(banned)) {
			t.Errorf("decisions_released leaks outcome word %q", banned)
		}
	}
	// Templates needing a CTA must actually contain the portal URL.
	for _, name := range []string{"decision_accepted", "decision_waitlisted", "decisions_released"} {
		out, _ := renderTemplate(name, data)
		if !strings.Contains(out, "https://portal.test") {
			t.Errorf("%s: missing portal URL", name)
		}
	}
	if _, _, err := decisionTemplate(Decision("bogus")); err == nil {
		t.Error("expected error for unknown decision")
	}
}

func TestQRAttachmentFilename(t *testing.T) {
	tests := map[string]struct {
		hackathonName string
		want          string
	}{
		"name and year":  {hackathonName: "HackUTD 2027", want: "hackutd-2027-qr-code.png"},
		"another school": {hackathonName: "SMU Hacks 2027", want: "smu-hacks-2027-qr-code.png"},
		"accents shed":   {hackathonName: "Hackatón México", want: "hackatn-mxico-qr-code.png"},
		"unset":          {hackathonName: "", want: defaultQRAttachmentFilename},
		"no ascii":       {hackathonName: "日本ハッカソン", want: defaultQRAttachmentFilename},
	}

	for testName, tt := range tests {
		t.Run(testName, func(t *testing.T) {
			if got := qrAttachmentFilename(tt.hackathonName); got != tt.want {
				t.Errorf("qrAttachmentFilename(%q) = %q, want %q", tt.hackathonName, got, tt.want)
			}
		})
	}
}
