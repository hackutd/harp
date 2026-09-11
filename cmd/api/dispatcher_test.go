package main

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newTestPushKeys generates a valid p256dh/auth pair so webpush encryption succeeds and a
// real HTTP request is actually made to the (test) endpoint.
func newTestPushKeys(t *testing.T) (p256dh, auth string) {
	t.Helper()
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	require.NoError(t, err)
	authBytes := make([]byte, 16)
	_, err = rand.Read(authBytes)
	require.NoError(t, err)
	return base64.RawURLEncoding.EncodeToString(priv.PublicKey().Bytes()),
		base64.RawURLEncoding.EncodeToString(authBytes)
}

// newPushServer returns a TLS httptest server that responds with the given status to any push.
// Endpoints must be https and on an allowed host, so tests allowlist the loopback address.
func newPushServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	return srv
}

// newTestDispatcherApp returns a test app whose push allowlist covers the httptest
// loopback servers.
func newTestDispatcherApp(t *testing.T) *application {
	t.Helper()
	app := newTestApplication(t)
	app.config.vapid.allowedEndpointHosts = []string{"127.0.0.1"}
	return app
}

// newTestVAPIDOptions builds dispatcher options that trust the shared httptest
// certificate. Every httptest TLS server uses the same cert, so one server's
// client works for all of them.
func newTestVAPIDOptions(t *testing.T, srv *httptest.Server) *webpush.Options {
	t.Helper()
	priv, pub, err := webpush.GenerateVAPIDKeys()
	require.NoError(t, err)
	client := srv.Client()
	client.Timeout = pushRequestTimeout
	client.CheckRedirect = newPushHTTPClient().CheckRedirect
	return &webpush.Options{
		VAPIDPublicKey:  pub,
		VAPIDPrivateKey: priv,
		Subscriber:      "mailto:test@example.com",
		TTL:             60,
		HTTPClient:      client,
	}
}

func newTestPushSub(t *testing.T, endpoint string) store.PushSubscription {
	t.Helper()
	p256dh, auth := newTestPushKeys(t)
	return store.PushSubscription{Endpoint: endpoint, P256dh: p256dh, Auth: auth}
}

func TestDeliverNotification(t *testing.T) {
	notification := store.ScheduledNotification{ID: "n1", Title: "Hi", Body: "There"}

	t.Run("prunes auth-failed sub but keeps delivering to live ones", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		live := newPushServer(t, http.StatusCreated)
		stale := newPushServer(t, http.StatusForbidden)
		subs := []store.PushSubscription{
			newTestPushSub(t, live.URL),
			newTestPushSub(t, stale.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", stale.URL).Return(nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, live))

		require.NoError(t, err)
		assert.Equal(t, 1, delivered)
		mockSubs.AssertExpectations(t)
	})

	t.Run("prunes both on mixed 410/403 with no delivery", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		gone := newPushServer(t, http.StatusGone)
		forbidden := newPushServer(t, http.StatusForbidden)
		subs := []store.PushSubscription{
			newTestPushSub(t, gone.URL),
			newTestPushSub(t, forbidden.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", gone.URL).Return(nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", forbidden.URL).Return(nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, gone))

		// 410 pruned, 403 auth-failed: nothing was reached, so this is not a send.
		require.Error(t, err)

		assert.Equal(t, 0, delivered)
		mockSubs.AssertExpectations(t)
	})

	t.Run("guard skips prune when every sub fails auth (suspected misconfig)", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		s1 := newPushServer(t, http.StatusForbidden)
		s2 := newPushServer(t, http.StatusUnauthorized)
		subs := []store.PushSubscription{
			newTestPushSub(t, s1.URL),
			newTestPushSub(t, s2.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, s1))

		assert.Equal(t, 0, delivered)
		// Retryable, not permanent: the operator may still fix the VAPID config.
		require.Error(t, err)
		assert.NotErrorIs(t, err, errDeliveryPermanent)
		mockSubs.AssertNotCalled(t, "DeleteByEndpointAdmin", mock.Anything)
		mockSubs.AssertExpectations(t)
	})

	t.Run("still prunes 410 (regression)", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		gone := newPushServer(t, http.StatusGone)
		subs := []store.PushSubscription{newTestPushSub(t, gone.URL)}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", gone.URL).Return(nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, gone))

		// Every sub was stale and pruned — there was genuinely nobody left to reach.
		require.NoError(t, err)

		assert.Equal(t, 0, delivered)
		mockSubs.AssertExpectations(t)
	})

	t.Run("prunes disallowed endpoints without contacting them", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		var hits atomic.Int32
		rogue := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			hits.Add(1)
			w.WriteHeader(http.StatusCreated)
		}))
		t.Cleanup(rogue.Close)

		live := newPushServer(t, http.StatusCreated)
		subs := []store.PushSubscription{
			newTestPushSub(t, rogue.URL), // plain http, not allowed
			newTestPushSub(t, "https://internal.example.com/push"),
			newTestPushSub(t, live.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", rogue.URL).Return(nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", "https://internal.example.com/push").Return(nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, live))

		require.NoError(t, err)

		assert.Equal(t, 1, delivered)
		assert.Equal(t, int32(0), hits.Load())
		mockSubs.AssertExpectations(t)
	})

	t.Run("does not follow redirects", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		var hits atomic.Int32
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			hits.Add(1)
			w.WriteHeader(http.StatusCreated)
		}))
		t.Cleanup(target.Close)

		redirect := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
		}))
		t.Cleanup(redirect.Close)

		subs := []store.PushSubscription{newTestPushSub(t, redirect.URL)}
		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()

		delivered, err := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, redirect))

		// The redirect is refused, so no push landed: retryable, not a send.
		require.Error(t, err)

		assert.Equal(t, 0, delivered)
		assert.Equal(t, int32(0), hits.Load())
		mockSubs.AssertNotCalled(t, "DeleteByEndpointAdmin", mock.Anything)
	})

	t.Run("times out on a hanging endpoint", func(t *testing.T) {
		app := newTestDispatcherApp(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		release := make(chan struct{})
		hang := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-release:
			case <-r.Context().Done():
			}
		}))
		t.Cleanup(func() {
			close(release)
			hang.Close()
		})

		subs := []store.PushSubscription{newTestPushSub(t, hang.URL)}
		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()

		options := newTestVAPIDOptions(t, hang)
		options.HTTPClient.(*http.Client).Timeout = 200 * time.Millisecond

		start := time.Now()
		delivered, err := app.deliverNotification(context.Background(), notification, options)

		// Timed out against every endpoint: must be retried, never marked sent.
		require.Error(t, err)

		assert.Equal(t, 0, delivered)
		assert.Less(t, time.Since(start), 5*time.Second)
	})
}

// newTestDispatcherAppWithVAPID returns a dispatcher app configured to actually send:
// dispatchDueNotifications builds its webpush options from app config rather than
// receiving them, so the keys and push client have to live on the app.
func newTestDispatcherAppWithVAPID(t *testing.T, srv *httptest.Server) *application {
	t.Helper()
	app := newTestDispatcherApp(t)

	priv, pub, err := webpush.GenerateVAPIDKeys()
	require.NoError(t, err)
	app.config.vapid.publicKey = pub
	app.config.vapid.privateKey = priv
	app.config.vapid.subject = "mailto:test@example.com"

	// Every httptest TLS server shares one cert, so this client trusts them all.
	client := srv.Client()
	client.Timeout = pushRequestTimeout
	client.CheckRedirect = newPushHTTPClient().CheckRedirect
	app.pushClient = client

	return app
}

// ctxRecordingNotificationsStore records the context ReleaseClaim was called with,
// so a test can prove bookkeeping is detached from a cancelled dispatcher context.
type ctxRecordingNotificationsStore struct {
	*store.MockScheduledNotificationsStore
	released      bool
	releaseCtxErr error
}

func (s *ctxRecordingNotificationsStore) ReleaseClaim(ctx context.Context, _, _ string) error {
	s.released = true
	s.releaseCtxErr = ctx.Err()
	return nil
}

// claimed builds a notification as ClaimDue would hand it back: leased, with the
// attempt already counted.
func claimed(id string, scheduledAt time.Time, attempts int) store.ScheduledNotification {
	now := time.Now()
	return store.ScheduledNotification{
		ID:          id,
		Title:       "Opening Ceremony",
		Body:        "Starting in 15 minutes",
		ScheduledAt: scheduledAt,
		ClaimedAt:   &now,
		Attempts:    attempts,
	}
}

// TestDispatchDueNotifications covers the claim-resolution contract: a claimed
// notification must always end up sent, released for retry, or terminally failed —
// never left leased, and never recorded as sent without a delivery.
func TestDispatchDueNotifications(t *testing.T) {
	anyClaim := []any{mock.Anything, mock.Anything, mock.Anything, mock.Anything}

	t.Run("marks sent after a real delivery", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherAppWithVAPID(t, live)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockNotifs.On("ClaimDue", anyClaim...).
			Return([]store.ScheduledNotification{claimed("n1", time.Now(), 1)}, nil).Once()
		mockSubs.On("ListByRole", mock.Anything).
			Return([]store.PushSubscription{newTestPushSub(t, live.URL)}, nil).Once()
		mockNotifs.On("MarkSent", "n1", 1).Return(nil).Once()

		app.dispatchDueNotifications(context.Background())

		mockNotifs.AssertExpectations(t)
		mockNotifs.AssertNotCalled(t, "ReleaseClaim", mock.Anything, mock.Anything)
		mockNotifs.AssertNotCalled(t, "MarkFailed", mock.Anything, mock.Anything)
	})

	t.Run("releases the claim when subscriptions cannot be listed", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherAppWithVAPID(t, live)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockNotifs.On("ClaimDue", anyClaim...).
			Return([]store.ScheduledNotification{claimed("n1", time.Now(), 1)}, nil).Once()
		mockSubs.On("ListByRole", mock.Anything).Return(nil, errors.New("db down")).Once()
		mockNotifs.On("ReleaseClaim", "n1", mock.Anything).Return(nil).Once()

		app.dispatchDueNotifications(context.Background())

		// The regression: this used to be recorded as a successful send.
		mockNotifs.AssertExpectations(t)
		mockNotifs.AssertNotCalled(t, "MarkSent", mock.Anything, mock.Anything)
		mockNotifs.AssertNotCalled(t, "MarkFailed", mock.Anything, mock.Anything)
	})

	t.Run("fails terminally once attempts are exhausted", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherAppWithVAPID(t, live)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockNotifs.On("ClaimDue", anyClaim...).
			Return([]store.ScheduledNotification{claimed("n1", time.Now(), dispatcherMaxAttempts)}, nil).Once()
		mockSubs.On("ListByRole", mock.Anything).Return(nil, errors.New("db down")).Once()
		mockNotifs.On("MarkFailed", "n1", mock.Anything).Return(nil).Once()

		app.dispatchDueNotifications(context.Background())

		mockNotifs.AssertExpectations(t)
		mockNotifs.AssertNotCalled(t, "ReleaseClaim", mock.Anything, mock.Anything)
		mockNotifs.AssertNotCalled(t, "MarkSent", mock.Anything, mock.Anything)
	})

	t.Run("expires a notification past the lateness window without sending", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherAppWithVAPID(t, live)
		app.config.dispatcher.maxLateness = 30 * time.Minute
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		stale := time.Now().Add(-2 * time.Hour)
		mockNotifs.On("ClaimDue", anyClaim...).
			Return([]store.ScheduledNotification{claimed("n1", stale, 1)}, nil).Once()
		mockNotifs.On("MarkFailed", "n1", mock.MatchedBy(func(cause string) bool {
			return strings.HasPrefix(cause, "expired:")
		})).Return(nil).Once()

		app.dispatchDueNotifications(context.Background())

		mockNotifs.AssertExpectations(t)
		// A "starting in 15 minutes" reminder two hours late must not go out at all.
		mockSubs.AssertNotCalled(t, "ListByRole", mock.Anything)
		mockNotifs.AssertNotCalled(t, "MarkSent", mock.Anything, mock.Anything)
	})

	t.Run("resolves the claim even when the dispatcher context is already cancelled", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherAppWithVAPID(t, live)

		recorder := &ctxRecordingNotificationsStore{
			MockScheduledNotificationsStore: app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore),
		}
		app.store.ScheduledNotifications = recorder
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		recorder.On("ClaimDue", anyClaim...).
			Return([]store.ScheduledNotification{claimed("n1", time.Now(), 1)}, nil).Once()
		mockSubs.On("ListByRole", mock.Anything).
			Return([]store.PushSubscription{newTestPushSub(t, live.URL)}, nil).Once()

		// This is the shutdown path: SIGTERM cancels the dispatcher context mid-flight.
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		app.dispatchDueNotifications(ctx)

		// Delivery is abandoned, but the claim is still handed back so the next
		// instance retries it. Before the fix the row stayed marked sent forever.
		require.True(t, recorder.released, "claim was not resolved after cancellation")
		require.NoError(t, recorder.releaseCtxErr, "bookkeeping ran on the cancelled context")
	})
}

// TestDispatchBatch covers the batch deadline. ClaimDue charges every claimed row
// an attempt up front, so rows the batch never reaches have to be handed back with
// that attempt refunded — otherwise a slow push service could exhaust a
// notification's attempts one deferral at a time without ever trying it.
func TestDispatchBatch(t *testing.T) {
	t.Run("hands back the rows it never reached when the deadline hits", func(t *testing.T) {
		release := make(chan struct{})
		hang := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-release:
			case <-r.Context().Done():
			}
		}))
		t.Cleanup(func() {
			close(release)
			hang.Close()
		})

		app := newTestDispatcherApp(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		// n1's only subscription hangs, so its delivery runs into the batch
		// deadline and is released for retry. n2 and n3 are never started.
		mockSubs.On("ListByRole", mock.Anything).
			Return([]store.PushSubscription{newTestPushSub(t, hang.URL)}, nil).Once()
		mockNotifs.On("ReleaseClaim", "n1", mock.Anything).Return(nil).Once()
		mockNotifs.On("ReleaseUnattempted", []string{"n2", "n3"}).Return(nil).Once()

		now := time.Now()
		due := []store.ScheduledNotification{claimed("n1", now, 1), claimed("n2", now, 1), claimed("n3", now, 1)}

		app.dispatchBatch(context.Background(), due, newTestVAPIDOptions(t, hang), now.Add(300*time.Millisecond))

		mockNotifs.AssertExpectations(t)
		mockSubs.AssertNumberOfCalls(t, "ListByRole", 1)
		mockNotifs.AssertNotCalled(t, "MarkSent", mock.Anything, mock.Anything)
		mockNotifs.AssertNotCalled(t, "MarkFailed", mock.Anything, mock.Anything)
	})

	t.Run("processes the whole batch when the deadline is not reached", func(t *testing.T) {
		live := newPushServer(t, http.StatusCreated)
		app := newTestDispatcherApp(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockSubs.On("ListByRole", mock.Anything).
			Return([]store.PushSubscription{newTestPushSub(t, live.URL)}, nil).Twice()
		mockNotifs.On("MarkSent", "n1", 1).Return(nil).Once()
		mockNotifs.On("MarkSent", "n2", 1).Return(nil).Once()

		now := time.Now()
		due := []store.ScheduledNotification{claimed("n1", now, 1), claimed("n2", now, 1)}

		app.dispatchBatch(context.Background(), due, newTestVAPIDOptions(t, live), now.Add(time.Minute))

		mockNotifs.AssertExpectations(t)
		mockNotifs.AssertNotCalled(t, "ReleaseUnattempted", mock.Anything)
	})
}
