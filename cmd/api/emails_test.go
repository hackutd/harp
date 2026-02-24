package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSendQREmails(t *testing.T) {
	aliceName := "Alice"
	users := []store.UserEmailInfo{
		{UserID: "uid-alice", Email: "alice@test.com", FirstName: &aliceName},
		{UserID: "uid-bob", Email: "bob@test.com", FirstName: nil},
	}

	t.Run("sends to all accepted hackers", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		mockApps.On("GetEmailsByStatus", store.StatusAccepted).Return(users, nil).Once()
		mockMailer.On("SendQREmail", "alice@test.com", "Alice", "uid-alice").Return(nil).Once()
		mockMailer.On("SendQREmail", "bob@test.com", "Hacker", "uid-bob").Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.sendQREmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendQREmailsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 2, body.Data.Total)
		assert.Equal(t, 2, body.Data.Sent)
		assert.Equal(t, 0, body.Data.Failed)

		mockApps.AssertExpectations(t)
		mockMailer.AssertExpectations(t)
	})

	t.Run("empty list returns zero counts", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockApps.On("GetEmailsByStatus", store.StatusAccepted).Return([]store.UserEmailInfo{}, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.sendQREmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendQREmailsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 0, body.Data.Total)

		mockApps.AssertExpectations(t)
	})

	t.Run("partial failure reports errors", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		mockApps.On("GetEmailsByStatus", store.StatusAccepted).Return(users, nil).Once()
		mockMailer.On("SendQREmail", "alice@test.com", "Alice", "uid-alice").Return(nil).Once()
		mockMailer.On("SendQREmail", "bob@test.com", "Hacker", "uid-bob").Return(errors.New("sendgrid error")).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.sendQREmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendQREmailsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 2, body.Data.Total)
		assert.Equal(t, 1, body.Data.Sent)
		assert.Equal(t, 1, body.Data.Failed)
		assert.Len(t, body.Data.Errors, 1)

		mockApps.AssertExpectations(t)
		mockMailer.AssertExpectations(t)
	})

	t.Run("store error returns 500", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockApps.On("GetEmailsByStatus", store.StatusAccepted).Return(nil, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.sendQREmailsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

// Ensure MockClient satisfies mailer.Client at compile time
var _ mailer.Client = (*mailer.MockClient)(nil)
