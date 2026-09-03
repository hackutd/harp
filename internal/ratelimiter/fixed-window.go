package ratelimiter

import (
	"sync"
	"time"
)

type bucket struct {
	count   int
	resetAt time.Time
}

// FixedWindowLimiter allows up to limit requests per key in each window.
// Windows are reset lazily on the next request for the key, and expired keys
// are swept from the map at most once per window, so no per-key goroutines
// are spawned.
type FixedWindowLimiter struct {
	mu        sync.Mutex
	clients   map[string]*bucket
	limit     int
	window    time.Duration
	nextSweep time.Time
	now       func() time.Time
}

func NewFixedWindowLimiter(limit int, window time.Duration) *FixedWindowLimiter {
	return &FixedWindowLimiter{
		clients: make(map[string]*bucket),
		limit:   limit,
		window:  window,
		now:     time.Now,
	}
}

func (rl *FixedWindowLimiter) Allow(key string) (bool, time.Duration) {
	now := rl.now()

	rl.mu.Lock()
	defer rl.mu.Unlock()

	if !now.Before(rl.nextSweep) {
		rl.sweep(now)
	}

	w, ok := rl.clients[key]
	if !ok || !now.Before(w.resetAt) {
		w = &bucket{resetAt: now.Add(rl.window)}
		rl.clients[key] = w
	}

	if w.count >= rl.limit {
		return false, w.resetAt.Sub(now)
	}
	w.count++
	return true, 0
}

// sweep drops every expired bucket. Caller must hold mu.
func (rl *FixedWindowLimiter) sweep(now time.Time) {
	for key, w := range rl.clients {
		if !now.Before(w.resetAt) {
			delete(rl.clients, key)
		}
	}
	rl.nextSweep = now.Add(rl.window)
}
