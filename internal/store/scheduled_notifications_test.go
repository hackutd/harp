package store

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// last_error is written by the statement that resolves a delivery lease, so a
// value Postgres refuses would leave the claim unresolved until it expires.
func TestTruncateCause(t *testing.T) {
	t.Run("short causes pass through untouched", func(t *testing.T) {
		if got := truncateCause("db down"); got != "db down" {
			t.Errorf("got %q", got)
		}
	})

	t.Run("a cause exactly at the bound passes through untouched", func(t *testing.T) {
		cause := strings.Repeat("a", maxLastErrorLen)
		if got := truncateCause(cause); got != cause {
			t.Errorf("len %d cause was altered", maxLastErrorLen)
		}
	})

	t.Run("long ASCII is cut to the bound with an ellipsis", func(t *testing.T) {
		got := truncateCause(strings.Repeat("a", 2*maxLastErrorLen))
		if len(got) != maxLastErrorLen {
			t.Errorf("len = %d, want %d", len(got), maxLastErrorLen)
		}
		if !strings.HasSuffix(got, "\u2026") {
			t.Errorf("missing ellipsis: %q", got[len(got)-8:])
		}
	})

	// Every byte offset around the cut point is covered by choosing rune widths
	// that do not divide the budget evenly.
	for _, tc := range []struct {
		name string
		r    string
	}{
		{"2-byte runes", "é"},
		{"3-byte runes", "…"},
		{"4-byte runes", "😀"},
	} {
		t.Run("never splits "+tc.name, func(t *testing.T) {
			got := truncateCause(strings.Repeat(tc.r, maxLastErrorLen))
			if !utf8.ValidString(got) {
				t.Fatal("produced invalid UTF-8, which Postgres rejects")
			}
			if len(got) > maxLastErrorLen {
				t.Errorf("len = %d, exceeds bound %d", len(got), maxLastErrorLen)
			}
			if !strings.HasSuffix(got, "\u2026") {
				t.Error("missing ellipsis")
			}
			body := strings.TrimSuffix(got, "\u2026")
			if strings.Trim(body, tc.r) != "" {
				t.Errorf("cut left a partial rune: %q", body[len(body)-8:])
			}
		})
	}
}
