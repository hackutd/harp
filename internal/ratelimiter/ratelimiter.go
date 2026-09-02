package ratelimiter

import "time"

type Limiter interface {
	Allow(key string) (bool, time.Duration)
}

type Config struct {
	// Budget for requests that carry a verified session, keyed by user ID.
	RequestPerTimeFrame int
	// Budget for requests without a verified session, keyed by client IP.
	// Kept separate because many attendees share one IP at the venue.
	IPRequestPerTimeFrame int
	TimeFrame             time.Duration
	Enabled               bool
}
