package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckEmailAuthMethod(t *testing.T) {
	app := newTestApplication(t)
	mux := app.mount()
	mockUsers := app.store.Users.(*store.MockUsersStore)

	t.Run("should return 400 when email param is missing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/auth/check-email", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return exists=false when email not found", func(t *testing.T) {
		mockUsers.On("GetByEmail", "unknown@test.com").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/auth/check-email?email=unknown@test.com", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data CheckEmailResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)

		assert.False(t, body.Data.Exists)
		assert.Nil(t, body.Data.AuthMethod)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return exists=true with auth method when email found", func(t *testing.T) {
		user := newTestUser()
		mockUsers.On("GetByEmail", "hacker@test.com").Return(user, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/auth/check-email?email=hacker@test.com", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data CheckEmailResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)

		assert.True(t, body.Data.Exists)
		require.NotNil(t, body.Data.AuthMethod)
		assert.Equal(t, store.AuthMethodPasswordless, *body.Data.AuthMethod)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 500 on store error", func(t *testing.T) {
		mockUsers.On("GetByEmail", "error@test.com").Return(nil, assert.AnError).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/auth/check-email?email=error@test.com", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockUsers.AssertExpectations(t)
	})
}

func TestGetCurrentUser(t *testing.T) {
	app := newTestApplication(t)

	t.Run("should return user when in context", func(t *testing.T) {
		user := newTestUser()

		req, err := http.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		require.NoError(t, err)

		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getCurrentUserHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data UserResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)

		assert.Equal(t, user.ID, body.Data.ID)
		assert.Equal(t, user.Email, body.Data.Email)
		assert.Equal(t, user.Role, body.Data.Role)
	})

	t.Run("should return 401 when no user in context", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.getCurrentUserHandler))
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}
