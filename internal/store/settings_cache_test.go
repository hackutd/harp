package store

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

// The cache must answer without touching the database, so every store here is
// built with a nil *sql.DB: if a read fell through to a query it would panic
// rather than quietly pass.

func TestSettingsCacheServesWithoutQuerying(t *testing.T) {
	s := newSettingsStore(nil)
	s.cacheStore("some_key", []byte(`true`), true)

	raw, found, err := s.getCachedRaw(context.Background(), "some_key")
	if err != nil {
		t.Fatalf("cached read returned an error: %v", err)
	}
	if !found || string(raw) != "true" {
		t.Fatalf("got (%q, %v), want (\"true\", true)", raw, found)
	}
}

func TestSettingsCacheRemembersMisses(t *testing.T) {
	// rsvp_enabled and travel_rsvp_enabled have no seed migration, so they have
	// no row until a super admin writes one. Without caching the miss those
	// keys would query on every single request.
	s := newSettingsStore(nil)
	s.cacheStore(SettingsKeyRSVPEnabled, nil, false)

	raw, found, err := s.getCachedRaw(context.Background(), SettingsKeyRSVPEnabled)
	if err != nil {
		t.Fatalf("cached miss returned an error: %v", err)
	}
	if found || raw != nil {
		t.Fatalf("got (%q, %v), want (nil, false)", raw, found)
	}
}

func TestSettingsCacheExpires(t *testing.T) {
	s := newSettingsStore(nil)
	s.cache["stale_key"] = cachedSetting{
		raw:     []byte(`true`),
		found:   true,
		expires: time.Now().Add(-time.Second),
	}

	// Expired, so this must fall through to the database -- which is nil.
	defer func() {
		if recover() == nil {
			t.Fatal("expired entry was served from the cache")
		}
	}()
	_, _, _ = s.getCachedRaw(context.Background(), "stale_key")
}

func TestSettingsCacheInvalidate(t *testing.T) {
	s := newSettingsStore(nil)
	s.cacheStore("key_a", []byte(`1`), true)
	s.cacheStore("key_b", []byte(`2`), true)

	s.invalidate("key_a")

	if _, ok := s.cache["key_a"]; ok {
		t.Error("invalidate left key_a behind")
	}
	if _, ok := s.cache["key_b"]; !ok {
		t.Error("invalidate dropped an unrelated key")
	}
}

func TestSettingsCacheInvalidateAll(t *testing.T) {
	s := newSettingsStore(nil)
	s.cacheStore("key_a", []byte(`1`), true)
	s.cacheStore("key_b", []byte(`2`), true)

	s.invalidateAll()

	if len(s.cache) != 0 {
		t.Errorf("invalidateAll left %d entries", len(s.cache))
	}
}

func TestSettingsCacheTTLIsShort(t *testing.T) {
	// Invalidation is in-process and Cloud Run runs several instances, so this
	// TTL is how long a toggle flip can take to reach them all. Keep it short.
	if settingsCacheTTL > 30*time.Second {
		t.Errorf("settingsCacheTTL = %v; too long for cross-instance toggle staleness", settingsCacheTTL)
	}
}

func TestSettingsCacheConcurrentAccess(t *testing.T) {
	// The cache is shared by every in-flight request, so reads, writes and
	// invalidations all land on the same map at once. Run under -race.
	//
	// Readers stay on a key nobody invalidates: with a nil *sql.DB a read that
	// missed would fall through to a query and panic, which would be this
	// test's own race rather than the cache's.
	const stable = "stable_key"
	s := newSettingsStore(nil)
	s.cacheStore(stable, []byte(`true`), true)

	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			churn := fmt.Sprintf("churn_key_%d", i)
			for n := 0; n < 200; n++ {
				switch i % 3 {
				case 0:
					raw, found, err := s.getCachedRaw(context.Background(), stable)
					if err != nil || !found || string(raw) != "true" {
						t.Errorf("cached read got (%q, %v, %v)", raw, found, err)
						return
					}
				case 1:
					s.cacheStore(churn, []byte(`1`), true)
				default:
					s.cacheStore(churn, []byte(`2`), true)
					s.invalidate(churn)
				}
			}
		}(i)
	}
	wg.Wait()

	if _, _, err := s.getCachedRaw(context.Background(), stable); err != nil {
		t.Fatalf("stable key lost after concurrent churn: %v", err)
	}
}
