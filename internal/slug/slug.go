// Package slug turns organizer-controlled display names into safe identifiers
// for storage prefixes and download filenames.
package slug

import (
	"strings"
	"unicode"
)

const maxHackathonRunes = 80

// UnconfiguredHackathon is returned by Hackathon when the configured name has
// no usable characters, so callers always get a stable, non-empty segment.
const UnconfiguredHackathon = "unconfigured-hackathon"

// Hackathon turns the organizer-controlled display name into one safe
// object-prefix segment. A year in the configured name (for example,
// "HackUTD 2027") naturally creates a new per-cycle prefix.
//
// This seeds live GCS object prefixes, so its output must stay stable: a change
// here orphans every resume uploaded under the old spelling.
func Hackathon(name string) string {
	var (
		builder      strings.Builder
		writtenRunes int
		separatorDue bool
	)

	for _, r := range strings.TrimSpace(name) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			runesNeeded := 1
			if separatorDue && writtenRunes > 0 {
				runesNeeded++
			}
			if writtenRunes+runesNeeded > maxHackathonRunes {
				break
			}

			if separatorDue && writtenRunes > 0 {
				builder.WriteByte('-')
				writtenRunes++
			}
			separatorDue = false
			builder.WriteRune(unicode.ToLower(r))
			writtenRunes++
			continue
		}

		if writtenRunes > 0 {
			separatorDue = true
		}
	}

	if builder.Len() == 0 {
		return UnconfiguredHackathon
	}
	return builder.String()
}

// ASCII drops every non-ASCII rune, returning "" when nothing survives.
//
// Hackathon is Unicode-aware and lowercases accented letters rather than
// transliterating them, so its output can contain bytes that do not belong in
// an HTTP Content-Disposition filename (RFC 6266) or an email attachment name.
// Callers that build a filename run the slug through this and fall back to a
// fixed name when the result is empty.
func ASCII(s string) string {
	var builder strings.Builder

	for _, r := range s {
		if r < unicode.MaxASCII {
			builder.WriteRune(r)
		}
	}

	return builder.String()
}
