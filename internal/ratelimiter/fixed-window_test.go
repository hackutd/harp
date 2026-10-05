package ratelimiter

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func newTestLimiter(limit int, window time.Duration) (*FixedWindowLimiter, *time.Time) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	rl := NewFixedWindowLimiter(limit, window)
	rl.now = func() time.Time { return now }
	return rl, &now
}

func TestFixedWindowLimiter_AllowsUpToLimit(t *testing.T) {
	rl, _ := newTestLimiter(3, time.Second)

	for i := 0; i < 3; i++ {
		if ok, _ := rl.Allow("k"); !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	if ok, _ := rl.Allow("k"); ok {
		t.Fatal("request over the limit should be denied")
	}
	if ok, _ := rl.Allow("other"); !ok {
		t.Fatal("a different key must have its own budget")
	}
}

func TestFixedWindowLimiter_RetryAfterIsTimeLeftInWindow(t *testing.T) {
	rl, now := newTestLimiter(1, 5*time.Second)

	rl.Allow("k")
	*now = now.Add(2 * time.Second)

	ok, retry := rl.Allow("k")
	if ok {
		t.Fatal("expected denial")
	}
	if retry != 3*time.Second {
		t.Fatalf("retry-after = %v, want 3s", retry)
	}
}

func TestFixedWindowLimiter_ResetsAfterWindow(t *testing.T) {
	rl, now := newTestLimiter(1, time.Second)

	rl.Allow("k")
	if ok, _ := rl.Allow("k"); ok {
		t.Fatal("expected denial inside the window")
	}

	*now = now.Add(time.Second)
	if ok, _ := rl.Allow("k"); !ok {
		t.Fatal("expected a fresh budget once the window elapsed")
	}
}

func TestFixedWindowLimiter_SweepsExpiredKeys(t *testing.T) {
	rl, now := newTestLimiter(1, time.Second)

	for _, k := range []string{"a", "b", "c"} {
		rl.Allow(k)
	}
	if got := len(rl.clients); got != 3 {
		t.Fatalf("len(clients) = %d, want 3", got)
	}

	*now = now.Add(time.Second)
	rl.Allow("d")

	rl.mu.Lock()
	defer rl.mu.Unlock()
	if got := len(rl.clients); got != 1 {
		t.Fatalf("len(clients) = %d after sweep, want 1 (only the live key)", got)
	}
	if _, ok := rl.clients["d"]; !ok {
		t.Fatal("live key must survive the sweep")
	}
}

func TestFixedWindowLimiter_ConcurrentRequestsNeverExceedLimit(t *testing.T) {
	const limit, workers, perWorker = 50, 32, 100
	rl := NewFixedWindowLimiter(limit, time.Minute)

	var allowed atomic.Int64
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			for j := 0; j < perWorker; j++ {
				if ok, _ := rl.Allow("shared"); ok {
					allowed.Add(1)
				}
			}
		}()
	}
	close(start)
	wg.Wait()

	if got := allowed.Load(); got != limit {
		t.Fatalf("allowed %d requests, want exactly %d", got, limit)
	}
}
