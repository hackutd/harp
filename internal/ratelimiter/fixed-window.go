package ratelimiter

import (
	"sync"
	"time"
)

type FixedWindowLimiter struct {
	sync.RWMutex
	clients map[string]int
	limit   int
	window  time.Duration
}

func NewFixedWindowLimiter(limit int, window time.Duration) *FixedWindowLimiter {
	return &FixedWindowLimiter{
		clients: make(map[string]int),
		limit:   limit,
		window:  window,
	}
}

func (rl *FixedWindowLimiter) Allow(key string) (bool, time.Duration) {
	rl.RLock()
	count, exists := rl.clients[key]
	rl.RUnlock()

	if !exists || count < rl.limit {
		rl.Lock()
		if !exists {
			go rl.resetCount(key)
		}

		rl.clients[key]++
		rl.Unlock()

		return true, 0
	}

	return false, rl.window
}

func (rl *FixedWindowLimiter) resetCount(key string) {
	time.Sleep(rl.window)
	rl.Lock()
	delete(rl.clients, key)
	rl.Unlock()
}
