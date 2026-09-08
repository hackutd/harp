package main

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, live))

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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, gone))

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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, s1))

		assert.Equal(t, 0, delivered)
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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, gone))

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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, live))

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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t, redirect))

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
		delivered := app.deliverNotification(context.Background(), notification, options)

		assert.Equal(t, 0, delivered)
		assert.Less(t, time.Since(start), 5*time.Second)
	})
}
