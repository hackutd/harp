package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDeleteMyAccount(t *testing.T) {
	t.Run("deletes the account on happy path", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)

		mockUsers.On("Delete", "user-1").Return(&store.DeletedUserPaths{}, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("deletes the uploaded resume and travel receipts", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		paths := &store.DeletedUserPaths{
			Resumes:        []string{"hackathons/hackutd-2026/resumes/user-1/abc.pdf"},
			TravelReceipts: []string{"hackathons/hackutd-2026/travel-receipts/user-1/def.png"},
		}
		mockUsers.On("Delete", "user-1").Return(paths, nil).Once()

		// Cleanup is a detached goroutine, so the assertion has to be on the
		// call happening at all, not on it having happened by the time the
		// handler returns.
		deleted := make(chan string, 2)
		mockGCS.On("DeleteObject", mock.Anything, mock.AnythingOfType("string")).
			Run(func(args mock.Arguments) { deleted <- args.Get(1).(string) }).
			Return(nil).Twice()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		got := []string{<-deleted, <-deleted}
		require.ElementsMatch(t, append(paths.Resumes, paths.TravelReceipts...), got)

		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 404 when the user is already gone", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)

		mockUsers.On("Delete", "user-1").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.deleteMyAccountHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)

		mockUsers.On("Delete", "user-1").Return(nil, errors.New("db down")).Once()

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

func decodeUserResponse(t *testing.T, body *strings.Reader) UserResponse {
	t.Helper()
	var resp struct {
		Data UserResponse `json:"data"`
	}
	require.NoError(t, json.NewDecoder(body).Decode(&resp))
	return resp.Data
}

func TestUpdateMyTheme(t *testing.T) {
	patchTheme := func(t *testing.T, app *application, body string) *httptest.ResponseRecorder {
		t.Helper()
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())
		return executeRequest(req, http.HandlerFunc(app.updateMyThemeHandler))
	}

	for _, theme := range []store.Theme{store.ThemeLight, store.ThemeDark} {
		t.Run("stores "+string(theme), func(t *testing.T) {
			app := newTestApplication(t)
			mockUsers := app.store.Users.(*store.MockUsersStore)
			mockUsers.On("UpdateTheme", "user-1", theme).Return(nil).Once()

			rr := patchTheme(t, app, `{"theme":"`+string(theme)+`"}`)
			checkResponseCode(t, http.StatusOK, rr.Code)

			resp := decodeUserResponse(t, strings.NewReader(rr.Body.String()))
			assert.Equal(t, "user-1", resp.ID)
			assert.Equal(t, theme, resp.Theme)
			mockUsers.AssertExpectations(t)
		})
	}

	for name, body := range map[string]string{
		"rejects an unknown theme": `{"theme":"blue"}`,
		"rejects a missing theme":  `{}`,
		"rejects malformed JSON":   `{"theme":`,
	} {
		t.Run(name, func(t *testing.T) {
			app := newTestApplication(t)
			mockUsers := app.store.Users.(*store.MockUsersStore)

			rr := patchTheme(t, app, body)
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
			mockUsers.AssertNotCalled(t, "UpdateTheme", mock.Anything, mock.Anything)
		})
	}

	t.Run("returns 404 when the user is gone", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockUsers.On("UpdateTheme", "user-1", store.ThemeLight).Return(store.ErrNotFound).Once()

		rr := patchTheme(t, app, `{"theme":"light"}`)
		checkResponseCode(t, http.StatusNotFound, rr.Code)
		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 500 on a store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockUsers.On("UpdateTheme", "user-1", store.ThemeLight).Return(errors.New("db down")).Once()

		rr := patchTheme(t, app, `{"theme":"light"}`)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
		mockUsers.AssertExpectations(t)
	})

	t.Run("returns 401 without a user", func(t *testing.T) {
		app := newTestApplication(t)
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(`{"theme":"light"}`))
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.updateMyThemeHandler))
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}
