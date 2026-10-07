package store

import (
	"encoding/base64"
	"testing"
	"time"
)

func TestDirectoryCursorRoundTrip(t *testing.T) {
	confirmed := time.Date(2026, 11, 14, 15, 4, 5, 123456000, time.UTC)
	cutoff := time.Date(2026, 11, 11, 15, 4, 5, 0, time.UTC)

	for _, c := range []DirectoryCursor{
		{Stale: false, StatusConfirmedAt: confirmed, UserID: "22222222-2222-2222-2222-222222222222"},
		{Stale: true, StatusConfirmedAt: confirmed, UserID: "22222222-2222-2222-2222-222222222222", StaleCutoff: &cutoff},
	} {
		got, err := DecodeDirectoryCursor(EncodeDirectoryCursor(c))
		if err != nil {
			t.Fatal(err)
		}
		if got.Stale != c.Stale || !got.StatusConfirmedAt.Equal(c.StatusConfirmedAt) || got.UserID != c.UserID {
			t.Fatalf("round trip: got %+v, want %+v", got, c)
		}
		if (got.StaleCutoff == nil) != (c.StaleCutoff == nil) ||
			(c.StaleCutoff != nil && !got.StaleCutoff.Equal(*c.StaleCutoff)) {
			t.Fatalf("stale cutoff: got %v, want %v", got.StaleCutoff, c.StaleCutoff)
		}
	}
}

func TestDecodeDirectoryCursorRejectsMalformed(t *testing.T) {
	for name, raw := range map[string]string{
		"not base64":     "%%%",
		"not json":       base64.URLEncoding.EncodeToString([]byte("0|2026-11-14T00:00:00Z|x")),
		"missing id":     base64.URLEncoding.EncodeToString([]byte(`{"c":"2026-11-14T00:00:00Z"}`)),
		"missing sort":   base64.URLEncoding.EncodeToString([]byte(`{"i":"22222222-2222-2222-2222-222222222222"}`)),
		"wrong id field": base64.URLEncoding.EncodeToString([]byte(`{"c":"2026-11-14T00:00:00Z","id":"x"}`)),
	} {
		if _, err := DecodeDirectoryCursor(raw); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestDirectoryAdminCursorRoundTrip(t *testing.T) {
	c := DirectoryAdminCursor{CreatedAt: time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC), UserID: "33333333-3333-3333-3333-333333333333"}
	got, err := DecodeDirectoryAdminCursor(EncodeDirectoryAdminCursor(c))
	if err != nil {
		t.Fatal(err)
	}
	if !got.CreatedAt.Equal(c.CreatedAt) || got.UserID != c.UserID {
		t.Fatalf("round trip: got %+v, want %+v", got, c)
	}
	if _, err := DecodeDirectoryAdminCursor(base64.URLEncoding.EncodeToString([]byte(`{"i":"x"}`))); err == nil {
		t.Fatal("expected an error for a cursor without a sort value")
	}
}
