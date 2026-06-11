package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetVapidPublicKey(t *testing.T) {
	t.Run("returns public key when configured", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.vapid.publicKey = "test-public-key"

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getVapidPublicKeyHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data VapidPublicKeyResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, "test-public-key", body.Data.PublicKey)
	})

	t.Run("returns 503 when not configured", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getVapidPublicKeyHandler))
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)
	})
}

func TestSubscribePush(t *testing.T) {
	t.Run("upserts the subscription on happy path", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.vapid.publicKey = "test-public-key"
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockSubs.On("Upsert", mock.AnythingOfType("*store.PushSubscription")).Run(func(args mock.Arguments) {
			sub := args.Get(0).(*store.PushSubscription)
			assert.Equal(t, "user-1", sub.UserID)
			assert.Equal(t, "https://fcm.googleapis.com/fcm/send/abc", sub.Endpoint)
		}).Return(nil).Once()

		body := `{"endpoint":"https://fcm.googleapis.com/fcm/send/abc","p256dh":"key","auth":"auth-secret","user_agent":"Chrome"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.subscribePushHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockSubs.AssertExpectations(t)
	})

	t.Run("returns 400 on missing endpoint", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.vapid.publicKey = "test-public-key"

		body := `{"p256dh":"key","auth":"auth-secret"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.subscribePushHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("returns 503 when not configured", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"endpoint":"https://example.com/x","p256dh":"key","auth":"a"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.subscribePushHandler))
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)
	})
}

func TestUnsubscribePush(t *testing.T) {
	t.Run("deletes the subscription on happy path", func(t *testing.T) {
		app := newTestApplication(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		endpoint := "https://fcm.googleapis.com/fcm/send/abc"
		mockSubs.On("DeleteByEndpoint", "user-1", endpoint).Return(nil).Once()

		body := `{"endpoint":"` + endpoint + `"}`
		req, err := http.NewRequest(http.MethodDelete, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.unsubscribePushHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockSubs.AssertExpectations(t)
	})

	t.Run("returns 404 when missing", func(t *testing.T) {
		app := newTestApplication(t)
		mockSubs := app.store.PushSubscriptions.(*store.MockPushSubscriptionsStore)

		mockSubs.On("DeleteByEndpoint", "user-1", "https://example.com/missing").Return(store.ErrNotFound).Once()

		body := `{"endpoint":"https://example.com/missing"}`
		req, err := http.NewRequest(http.MethodDelete, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.unsubscribePushHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSubs.AssertExpectations(t)
	})
}
