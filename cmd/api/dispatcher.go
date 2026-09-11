package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/hackutd/harp/internal/store"
)

const (
	dispatcherTickInterval = 15 * time.Second
	dispatcherClaimLimit   = 10
	// dispatcherLease is how long a claim survives a hard kill (SIGKILL, OOM) before
	// another instance may reclaim the notification. The graceful path releases the
	// claim explicitly, so this only covers the process dying without warning. It must
	// stay comfortably above dispatcherDeliveryTimeout or a slow fan-out could be
	// claimed twice while it is still running.
	dispatcherLease           = 2 * time.Minute
	dispatcherMaxAttempts     = 5
	dispatcherDeliveryTimeout = 90 * time.Second
	// dispatcherBookkeepingTimeout bounds the writes that resolve a claim. These run on
	// a context detached from shutdown, so they need their own deadline.
	dispatcherBookkeepingTimeout = 5 * time.Second
	// dispatcherSendConcurrency keeps a large fan-out inside the delivery timeout:
	// pushRequestTimeout is 10s per subscription, so a sequential loop over a few
	// hundred hackers could otherwise outlive its own lease.
	dispatcherSendConcurrency = 16
	// dispatcherLeaseSafetyMargin is the slack left at the end of a lease for the
	// bookkeeping write that resolves the claim.
	dispatcherLeaseSafetyMargin = 15 * time.Second
)

// errDeliveryPermanent marks a failure that retrying cannot fix, so the dispatcher
// gives up immediately instead of burning every attempt on it.
var errDeliveryPermanent = errors.New("permanent delivery failure")

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

	// Sweep once on startup so a fresh instance picks up work abandoned by the
	// instance it replaced, rather than waiting out a full tick first.
	app.dispatchDueNotifications(ctx)

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
	claimedAt := time.Now()
	due, err := app.store.ScheduledNotifications.ClaimDue(
		ctx, claimedAt, dispatcherLease, dispatcherMaxAttempts, dispatcherClaimLimit,
	)
	if err != nil {
		app.logger.Errorw("failed to claim due notifications", "error", err)
		return
	}

	if len(due) == 0 {
		return
	}

	app.logger.Infow("dispatching due notifications", "count", len(due))

	options := &webpush.Options{
		VAPIDPublicKey:  app.config.vapid.publicKey,
		VAPIDPrivateKey: app.config.vapid.privateKey,
		Subscriber:      app.config.vapid.subject,
		TTL:             60 * 60, // 1 hour
		HTTPClient:      app.pushClient,
	}

	// The whole batch has to finish inside the lease taken above, or a slow tail
	// could be claimed by a second instance while this one is still sending.
	// Anything left over keeps its claim and is picked up once the lease lapses.
	batchDeadline := claimedAt.Add(dispatcherLease - dispatcherLeaseSafetyMargin)

	for i, n := range due {
		if !time.Now().Before(batchDeadline) {
			app.logger.Warnw("stopping dispatch batch before lease expiry",
				"processed", i, "deferred", len(due)-i)
			return
		}
		app.processNotification(ctx, n, options, batchDeadline)
	}
}

// processNotification delivers one claimed notification and always resolves its
// claim — marking it sent, releasing it for the next tick, or failing it terminally.
// A claim that is never resolved is exactly the bug this is here to prevent.
func (app *application) processNotification(ctx context.Context, n store.ScheduledNotification, options *webpush.Options, batchDeadline time.Time) {
	// Bookkeeping must outlive the dispatcher context. On SIGTERM ctx is already
	// cancelled, and the write below is what stops the notification being lost.
	book, cancelBook := context.WithTimeout(context.WithoutCancel(ctx), dispatcherBookkeepingTimeout)
	defer cancelBook()

	// A "starting in 15 minutes" reminder delivered an hour late is worse than none,
	// so past the grace window the notification is failed rather than sent.
	if late := time.Since(n.ScheduledAt); late > app.config.dispatcher.maxLateness {
		cause := fmt.Sprintf("expired: %s past scheduled time", late.Round(time.Second))
		app.logger.Warnw("skipping stale notification", "id", n.ID, "title", n.Title, "late", late)
		if err := app.store.ScheduledNotifications.MarkFailed(book, n.ID, cause); err != nil {
			app.logger.Errorw("failed to mark notification expired", "id", n.ID, "error", err)
		}
		return
	}

	// Delivery uses the cancellable context so shutdown aborts pushes promptly; the
	// claim is then released below and the next instance retries. It is also capped
	// by the batch deadline so one hanging push service cannot eat the lease.
	deadline := time.Now().Add(dispatcherDeliveryTimeout)
	if deadline.After(batchDeadline) {
		deadline = batchDeadline
	}
	deliverCtx, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()

	count, err := app.deliverNotification(deliverCtx, n, options)

	switch {
	case err == nil:
		app.logger.Infow("notification dispatched", "id", n.ID, "title", n.Title, "recipients", count)
		if err := app.store.ScheduledNotifications.MarkSent(book, n.ID, count); err != nil {
			app.logger.Errorw("failed to mark notification sent", "id", n.ID, "error", err)
		}
	case errors.Is(err, errDeliveryPermanent) || n.Attempts >= dispatcherMaxAttempts:
		app.logger.Errorw("giving up on notification", "id", n.ID, "title", n.Title, "attempts", n.Attempts, "error", err)
		if err := app.store.ScheduledNotifications.MarkFailed(book, n.ID, err.Error()); err != nil {
			app.logger.Errorw("failed to mark notification failed", "id", n.ID, "error", err)
		}
	default:
		app.logger.Warnw("notification delivery failed, will retry", "id", n.ID, "title", n.Title, "attempts", n.Attempts, "error", err)
		if err := app.store.ScheduledNotifications.ReleaseClaim(book, n.ID, err.Error()); err != nil {
			app.logger.Errorw("failed to release notification claim", "id", n.ID, "error", err)
		}
	}
}

// sendResult is one subscription's outcome, recorded per-index so the aggregation
// below stays deterministic despite the concurrent fan-out.
type sendResult struct {
	delivered bool
	authFail  bool
	prune     bool
	// transient marks a send that failed for a reason that may not recur — a network
	// error, a timeout, an unexpected status. Distinct from prune, which means the
	// subscription itself is dead and retrying it is pointless.
	transient bool
}

// deliverNotification fans a notification out to every subscription for its target
// role. A non-nil error means the attempt should be retried (or, if it wraps
// errDeliveryPermanent, abandoned) — it must never be reported as a successful send.
// Partial delivery is success: re-sending would duplicate for endpoints that worked.
func (app *application) deliverNotification(ctx context.Context, n store.ScheduledNotification, options *webpush.Options) (int, error) {
	subs, err := app.store.PushSubscriptions.ListByRole(ctx, n.TargetRole)
	if err != nil {
		return 0, fmt.Errorf("list subscriptions: %w", err)
	}

	if len(subs) == 0 {
		return 0, nil
	}

	payloadURL := n.URL
	body, err := json.Marshal(pushPayload{
		ID:    n.ID,
		Title: n.Title,
		Body:  n.Body,
		URL:   payloadURL,
	})
	if err != nil {
		return 0, fmt.Errorf("%w: marshal push payload: %v", errDeliveryPermanent, err)
	}

	results := make([]sendResult, len(subs))
	sem := make(chan struct{}, dispatcherSendConcurrency)
	var wg sync.WaitGroup

	for i, sub := range subs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			results[i] = app.sendToSubscription(ctx, body, sub, options)
		}()
	}
	wg.Wait()

	delivered := 0
	authFailures := 0
	transient := 0
	var toPrune []string

	for i, res := range results {
		if res.delivered {
			delivered++
		}
		if res.authFail {
			authFailures++
		}
		if res.transient {
			transient++
		}
		if res.prune {
			toPrune = append(toPrune, subs[i].Endpoint)
		}
	}

	// Mass-delete guard: if every sub failed VAPID auth and none delivered, this is almost
	// certainly a server-side VAPID misconfig, not individually stale subs — don't nuke the
	// whole table; leave the rows for the operator and retry once the config is fixed.
	if delivered == 0 && authFailures > 0 && authFailures == len(subs) {
		app.logger.Warnw("all push sends failed VAPID auth; skipping prune (check VAPID config)", "id", n.ID, "count", len(subs))
		return delivered, errors.New("all push sends failed VAPID auth (check VAPID config)")
	}

	for _, endpoint := range toPrune {
		if err := app.store.PushSubscriptions.DeleteByEndpointAdmin(ctx, endpoint); err != nil {
			app.logger.Warnw("failed to delete dead subscription", "endpoint_host", pushEndpointHost(endpoint), "error", err)
		}
	}

	// Reaching nobody is only a success if there was nobody left to reach: every
	// subscription was stale and got pruned. If sends failed for reasons that might
	// not recur, this attempt has to be retried rather than recorded as delivered.
	if delivered == 0 && (authFailures > 0 || transient > 0) {
		return 0, fmt.Errorf("no subscriptions reached (%d transient failures, %d auth failures, %d subscriptions)",
			transient, authFailures, len(subs))
	}

	return delivered, nil
}

func (app *application) sendToSubscription(ctx context.Context, body []byte, sub store.PushSubscription, options *webpush.Options) sendResult {
	if err := validatePushEndpoint(sub.Endpoint, app.config.vapid.allowedEndpointHosts); err != nil {
		app.logger.Warnw("pruning subscription with disallowed endpoint", "endpoint_host", pushEndpointHost(sub.Endpoint))
		return sendResult{prune: true}
	}

	// webpush wraps the payload in a bytes.Buffer and appends its padding delimiter
	// into the slice's spare capacity, so concurrent sends must not share one slice.
	// bytes.Clone returns cap == len, forcing that first append to allocate.
	payload := bytes.Clone(body)

	webpushSub := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			Auth:   sub.Auth,
			P256dh: sub.P256dh,
		},
	}

	resp, err := webpush.SendNotificationWithContext(ctx, payload, webpushSub, options)
	if err != nil {
		app.logger.Warnw("push send failed", "endpoint_host", pushEndpointHost(sub.Endpoint), "error", pushSendError(err))
		return sendResult{transient: true}
	}

	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, pushResponseBodyCap))
	resp.Body.Close()

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return sendResult{delivered: true}
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return sendResult{prune: true}
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		app.logger.Warnw("push auth rejected (stale VAPID key?)", "endpoint_host", pushEndpointHost(sub.Endpoint), "status", resp.StatusCode)
		return sendResult{authFail: true, prune: true}
	default:
		app.logger.Warnw("push send returned unexpected status", "endpoint_host", pushEndpointHost(sub.Endpoint), "status", resp.StatusCode)
		return sendResult{transient: true}
	}
}
