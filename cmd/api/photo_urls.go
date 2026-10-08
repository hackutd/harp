package main

import (
	"context"
	"sync"
	"time"

	"github.com/hackutd/harp/internal/store"
)

const (
	// headshotURLCacheTTL is how long a signed headshot URL is reused. GCS
	// signs download URLs for 15 minutes, so a URL handed out at the end of
	// this window still has 5 minutes left for the browser to load it.
	headshotURLCacheTTL = 10 * time.Minute
	// headshotURLCacheMax bounds the cache; one entry per uploaded headshot
	// comfortably covers an event.
	headshotURLCacheMax = 5000
	// headshotSignConcurrency caps parallel signing per request. On Cloud Run
	// each signature is a call to the IAM signBlob API.
	headshotSignConcurrency = 8
)

type signedURLEntry struct {
	url     string
	expires time.Time
}

// signedURLCache remembers signed download URLs by object path, so browsing
// the same cards again doesn't re-sign every headshot. The zero value is ready
// to use.
type signedURLCache struct {
	mu      sync.Mutex
	entries map[string]signedURLEntry
}

func (c *signedURLCache) get(path string, now time.Time) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[path]
	if !ok || !now.Before(e.expires) {
		return "", false
	}
	return e.url, true
}

func (c *signedURLCache) put(path, url string, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = make(map[string]signedURLEntry)
	}
	if len(c.entries) >= headshotURLCacheMax {
		for p, e := range c.entries {
			if !now.Before(e.expires) {
				delete(c.entries, p)
			}
		}
		if len(c.entries) >= headshotURLCacheMax {
			c.entries = make(map[string]signedURLEntry)
		}
	}
	c.entries[path] = signedURLEntry{url: url, expires: now.Add(headshotURLCacheTTL)}
}

// photoURL signs a user's uploaded profile photo, falling back to their Google
// picture. Every place a user's picture is shown resolves it through here.
func (app *application) photoURL(ctx context.Context, headshotPath, profilePictureURL *string) *string {
	if headshotPath != nil && *headshotPath != "" && app.gcsClient != nil {
		now := time.Now()
		if url, ok := app.headshotURLs.get(*headshotPath, now); ok {
			return &url
		}
		url, err := app.gcsClient.GenerateDownloadURL(ctx, *headshotPath)
		if err == nil {
			app.headshotURLs.put(*headshotPath, url, now)
			return &url
		}
		app.logger.Warnw("failed to sign profile photo", "error", err)
	}
	if profilePictureURL != nil && *profilePictureURL != "" {
		return profilePictureURL
	}
	return nil
}

// forEachBounded calls fn for every index in [0, n), at most limit at a time.
func forEachBounded(n, limit int, fn func(i int)) {
	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int) {
			defer wg.Done()
			defer func() { <-sem }()
			fn(i)
		}(i)
	}
	wg.Wait()
}

func (app *application) withCardPhotos(ctx context.Context, cards []store.DirectoryCard) []store.DirectoryCard {
	forEachBounded(len(cards), headshotSignConcurrency, func(i int) {
		cards[i].HeadshotURL = app.photoURL(ctx, cards[i].HeadshotPath, cards[i].ProfilePictureURL)
	})
	return cards
}

func (app *application) withAdminPhotos(ctx context.Context, profiles []store.DirectoryAdminProfile) []store.DirectoryAdminProfile {
	forEachBounded(len(profiles), headshotSignConcurrency, func(i int) {
		profiles[i].HeadshotURL = app.photoURL(ctx, profiles[i].HeadshotPath, profiles[i].ProfilePictureURL)
	})
	return profiles
}
