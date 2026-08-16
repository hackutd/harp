package mailer

import (
	"strings"
	"testing"
)

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
