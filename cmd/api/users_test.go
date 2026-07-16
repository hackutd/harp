package main

import (
	"errors"
	"net/http"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/require"
)

func TestDeleteMyAccount(t *testing.T) {
	t.Run("deletes the account on happy path", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)

		mockUsers.On("Delete", "user-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)

		mockUsers.On("Delete", "user-1").Return(errors.New("db down")).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 401 when user missing from context", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}
