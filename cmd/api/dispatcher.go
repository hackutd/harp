package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/hackutd/portal/internal/store"
)

const (
	dispatcherTickInterval = 15 * time.Second
	dispatcherClaimLimit   = 10
)

type pushPayload struct {
	ID    string  `json:"id"`
	Title string  `json:"title"`
	Body  string  `json:"body"`
	URL   *string `json:"url,omitempty"`
}

func (app *application) runNotificationDispatcher(ctx context.Context) {
	if app.config.vapid.publicKey == "" || app.config.vapid.privateKey == "" {
		app.logger.Infow("push dispatcher disabled (VAPID not configured)")
		return
	}

	app.logger.Infow("push dispatcher started", "interval", dispatcherTickInterval)

	ticker := time.NewTicker(dispatcherTickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			app.logger.Infow("push dispatcher stopped")
			return
		case <-ticker.C:
			app.dispatchDueNotifications(ctx)
		}
	}
}

func (app *application) dispatchDueNotifications(ctx context.Context) {
	due, err := app.store.ScheduledNotifications.ClaimDue(ctx, time.Now(), dispatcherClaimLimit)
	if err != nil {
		app.logger.Errorw("failed to claim due notifications", "error", err)
		return
	}

	if len(due) == 0 {
		return
	}

	options := &webpush.Options{
		VAPIDPublicKey:  app.config.vapid.publicKey,
		VAPIDPrivateKey: app.config.vapid.privateKey,
		Subscriber:      app.config.vapid.subject,
		TTL:             60 * 60, // 1 hour
	}

	for _, n := range due {
		count := app.deliverNotification(ctx, n, options)
		if err := app.store.ScheduledNotifications.MarkSent(ctx, n.ID, count); err != nil {
			app.logger.Errorw("failed to record recipient count", "id", n.ID, "error", err)
		}
	}
}

func (app *application) deliverNotification(ctx context.Context, n store.ScheduledNotification, options *webpush.Options) int {
	subs, err := app.store.PushSubscriptions.ListByRole(ctx, n.TargetRole)
	if err != nil {
		app.logger.Errorw("failed to list subscriptions", "id", n.ID, "error", err)
		return 0
	}

	if len(subs) == 0 {
		return 0
	}

	payloadURL := n.URL
	body, err := json.Marshal(pushPayload{
		ID:    n.ID,
		Title: n.Title,
		Body:  n.Body,
		URL:   payloadURL,
	})
	if err != nil {
		app.logger.Errorw("failed to marshal push payload", "id", n.ID, "error", err)
		return 0
	}

	delivered := 0
	for _, sub := range subs {
		webpushSub := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				Auth:   sub.Auth,
				P256dh: sub.P256dh,
			},
		}

		resp, err := webpush.SendNotificationWithContext(ctx, body, webpushSub, options)
		if err != nil {
			app.logger.Warnw("push send failed", "endpoint", sub.Endpoint, "error", err)
			continue
		}

		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		switch {
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			delivered++
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
			if err := app.store.PushSubscriptions.DeleteByEndpointAdmin(ctx, sub.Endpoint); err != nil {
				app.logger.Warnw("failed to delete dead subscription", "endpoint", sub.Endpoint, "error", err)
			}
		default:
			app.logger.Warnw("push send returned unexpected status", "endpoint", sub.Endpoint, "status", resp.StatusCode)
		}
	}

	return delivered
}
