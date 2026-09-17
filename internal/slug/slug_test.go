package slug

import (
	"strings"
	"testing"
)

func TestHackathon(t *testing.T) {
	tests := map[string]struct {
		name string
		want string
	}{
		"name and year":     {name: "HackUTD 2027", want: "hackutd-2027"},
		"unsafe separators": {name: "  Pearl / Hacks: 2027!  ", want: "pearl-hacks-2027"},
		"unicode name":      {name: "Hackatón México 2027", want: "hackatón-méxico-2027"},
		"unconfigured":      {name: "", want: UnconfiguredHackathon},
		"punctuation only":  {name: "///", want: UnconfiguredHackathon},
	}

	for testName, tt := range tests {
		t.Run(testName, func(t *testing.T) {
			if got := Hackathon(tt.name); got != tt.want {
				t.Errorf("Hackathon(%q) = %q, want %q", tt.name, got, tt.want)
			}
		})
	}
}

func TestHackathonTruncatesLongNames(t *testing.T) {
	got := Hackathon(strings.Repeat("a", maxHackathonRunes+20))
	if len([]rune(got)) != maxHackathonRunes {
		t.Errorf("Hackathon() returned %d runes, want %d", len([]rune(got)), maxHackathonRunes)
	}
}

func TestASCII(t *testing.T) {
	tests := map[string]struct {
		in   string
		want string
	}{
		"already ascii":  {in: "hackutd-2027", want: "hackutd-2027"},
		"accents shed":   {in: "hackatón-méxico-2027", want: "hackatn-mxico-2027"},
		"nothing usable": {in: "日本ハッカソン", want: ""},
		"empty":          {in: "", want: ""},
	}

	for testName, tt := range tests {
		t.Run(testName, func(t *testing.T) {
			if got := ASCII(tt.in); got != tt.want {
				t.Errorf("ASCII(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
