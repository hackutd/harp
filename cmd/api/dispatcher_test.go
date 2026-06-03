package main

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/hackutd/portal/internal/store"
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

// newPushServer returns an httptest server that responds with the given status to any push.
func newPushServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newTestVAPIDOptions(t *testing.T) *webpush.Options {
	t.Helper()
	priv, pub, err := webpush.GenerateVAPIDKeys()
	require.NoError(t, err)
	return &webpush.Options{
		VAPIDPublicKey:  pub,
		VAPIDPrivateKey: priv,
		Subscriber:      "mailto:test@example.com",
		TTL:             60,
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
		app := newTestApplication(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		live := newPushServer(t, http.StatusCreated)
		stale := newPushServer(t, http.StatusForbidden)
		subs := []store.PushSubscription{
			newTestPushSub(t, live.URL),
			newTestPushSub(t, stale.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", stale.URL).Return(nil).Once()

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t))

		assert.Equal(t, 1, delivered)
		mockSubs.AssertExpectations(t)
	})

	t.Run("prunes both on mixed 410/403 with no delivery", func(t *testing.T) {
		app := newTestApplication(t)
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

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t))

		assert.Equal(t, 0, delivered)
		mockSubs.AssertExpectations(t)
	})

	t.Run("guard skips prune when every sub fails auth (suspected misconfig)", func(t *testing.T) {
		app := newTestApplication(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		s1 := newPushServer(t, http.StatusForbidden)
		s2 := newPushServer(t, http.StatusUnauthorized)
		subs := []store.PushSubscription{
			newTestPushSub(t, s1.URL),
			newTestPushSub(t, s2.URL),
		}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t))

		assert.Equal(t, 0, delivered)
		mockSubs.AssertNotCalled(t, "DeleteByEndpointAdmin", mock.Anything)
		mockSubs.AssertExpectations(t)
	})

	t.Run("still prunes 410 (regression)", func(t *testing.T) {
		app := newTestApplication(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		gone := newPushServer(t, http.StatusGone)
		subs := []store.PushSubscription{newTestPushSub(t, gone.URL)}

		mockSubs.On("ListByRole", mock.Anything).Return(subs, nil).Once()
		mockSubs.On("DeleteByEndpointAdmin", gone.URL).Return(nil).Once()

		delivered := app.deliverNotification(context.Background(), notification, newTestVAPIDOptions(t))

		assert.Equal(t, 0, delivered)
		mockSubs.AssertExpectations(t)
	})
}
