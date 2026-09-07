package store

import (
	"testing"
)

// TrackPrizes is the only hand-written JSONB codec in this package, so the
// round trip through the driver is worth pinning down.
func TestTrackPrizesScan(t *testing.T) {
	t.Run("a NULL column scans to an empty slice", func(t *testing.T) {
		var prizes TrackPrizes
		if err := prizes.Scan(nil); err != nil {
			t.Fatalf("Scan(nil): %v", err)
		}
		if prizes == nil || len(prizes) != 0 {
			t.Fatalf("expected empty non-nil slice, got %#v", prizes)
		}
	})

	t.Run("an empty JSON array scans to an empty slice", func(t *testing.T) {
		var prizes TrackPrizes
		if err := prizes.Scan([]byte("[]")); err != nil {
			t.Fatalf("Scan([]): %v", err)
		}
		if prizes == nil || len(prizes) != 0 {
			t.Fatalf("expected empty non-nil slice, got %#v", prizes)
		}
	})

	t.Run("a JSON null scans to an empty slice", func(t *testing.T) {
		var prizes TrackPrizes
		if err := prizes.Scan([]byte("null")); err != nil {
			t.Fatalf("Scan(null): %v", err)
		}
		if prizes == nil || len(prizes) != 0 {
			t.Fatalf("expected empty non-nil slice, got %#v", prizes)
		}
	})

	t.Run("populated rows scan in order", func(t *testing.T) {
		var prizes TrackPrizes
		raw := `[{"place":"1st","prize":"$300 Amazon gift card"},{"place":"2nd","prize":"AirPods Pro"}]`
		if err := prizes.Scan([]byte(raw)); err != nil {
			t.Fatalf("Scan: %v", err)
		}
		if len(prizes) != 2 {
			t.Fatalf("expected 2 prizes, got %d", len(prizes))
		}
		if prizes[0].Place != "1st" || prizes[0].Prize != "$300 Amazon gift card" {
			t.Fatalf("unexpected first prize: %#v", prizes[0])
		}
		if prizes[1].Place != "2nd" {
			t.Fatalf("unexpected second prize: %#v", prizes[1])
		}
	})

	t.Run("a string source scans like a byte slice", func(t *testing.T) {
		var prizes TrackPrizes
		if err := prizes.Scan(`[{"place":"1st","prize":"A GPU"}]`); err != nil {
			t.Fatalf("Scan(string): %v", err)
		}
		if len(prizes) != 1 || prizes[0].Prize != "A GPU" {
			t.Fatalf("unexpected prizes: %#v", prizes)
		}
	})

	t.Run("an unsupported source type errors", func(t *testing.T) {
		var prizes TrackPrizes
		if err := prizes.Scan(42); err == nil {
			t.Fatal("expected an error for an int source")
		}
	})
}

func TestTrackPrizesValue(t *testing.T) {
	t.Run("a nil slice serializes to an empty JSON array", func(t *testing.T) {
		var prizes TrackPrizes
		v, err := prizes.Value()
		if err != nil {
			t.Fatalf("Value: %v", err)
		}
		b, ok := v.([]byte)
		if !ok {
			t.Fatalf("expected []byte, got %T", v)
		}
		if string(b) != "[]" {
			t.Fatalf("expected [], got %q", string(b))
		}
	})

	t.Run("a round trip preserves order and content", func(t *testing.T) {
		original := TrackPrizes{
			{Place: "1st", Prize: "$300 Amazon gift card"},
			{Place: "2nd", Prize: "AirPods Pro"},
		}

		v, err := original.Value()
		if err != nil {
			t.Fatalf("Value: %v", err)
		}

		var decoded TrackPrizes
		if err := decoded.Scan(v); err != nil {
			t.Fatalf("Scan: %v", err)
		}

		if len(decoded) != len(original) {
			t.Fatalf("expected %d prizes, got %d", len(original), len(decoded))
		}
		for i := range original {
			if decoded[i] != original[i] {
				t.Fatalf("prize %d changed: %#v -> %#v", i, original[i], decoded[i])
			}
		}
	})
}
