package main

import (
	"context"
	"encoding/json"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

const directPushTimeout = 20 * time.Second

// sendPushToUsers sends a one-off push notification to specific users in the
// background. It is best effort: there is no retry, and users without a
// subscription simply don't get one.
func (app *application) sendPushToUsers(userIDs []string, title, body, url string) {
	if app.config.vapid.publicKey == "" || app.config.vapid.privateKey == "" || len(userIDs) == 0 {
		return
	}

	id, err := randomHex(16)
	if err != nil {
		app.logger.Warnw("failed to build push id", "error", err)
		return
	}
	payload, err := json.Marshal(pushPayload{ID: id, Title: title, Body: body, URL: &url})
	if err != nil {
		app.logger.Warnw("failed to marshal push payload", "error", err)
		return
	}

	app.backgroundJobs.Add(1)
	go func() {
		defer app.backgroundJobs.Done()
		ctx, cancel := context.WithTimeout(context.Background(), directPushTimeout)
		defer cancel()

		subs, err := app.store.PushSubscriptions.ListByUserIDs(ctx, userIDs)
		if err != nil {
			app.logger.Warnw("failed to list push subscriptions", "error", err)
			return
		}

		options := &webpush.Options{
			VAPIDPublicKey:  app.config.vapid.publicKey,
			VAPIDPrivateKey: app.config.vapid.privateKey,
			Subscriber:      app.config.vapid.subject,
			TTL:             60 * 60,
			HTTPClient:      app.pushClient,
		}
		for _, sub := range subs {
			res := app.sendToSubscription(ctx, payload, sub, options)
			if res.prune {
				if err := app.store.PushSubscriptions.DeleteByEndpointAdmin(ctx, sub.Endpoint); err != nil {
					app.logger.Warnw("failed to delete dead subscription", "endpoint_host", pushEndpointHost(sub.Endpoint), "error", err)
				}
			}
		}
	}()
}
