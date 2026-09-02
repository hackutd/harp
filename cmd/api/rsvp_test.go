package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newAcceptedApplication returns an accepted application with a pending RSVP
func newAcceptedApplication(userID string) *store.Application {
	return &store.Application{
		ID:            "app-1",
		UserID:        userID,
		Status:        store.StatusAccepted,
		Responses:     json.RawMessage(`{}`),
		RSVPStatus:    store.RSVPPending,
		RSVPResponses: json.RawMessage(`{}`),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

func newRSVPSchema() []store.ApplicationSchemaField {
	return []store.ApplicationSchemaField{
		{ID: "shirt_size", Type: "select", Label: "Shirt Size", Required: true, Options: []string{"S", "M", "L"}},
		{ID: "dietary_notes", Type: "text", Label: "Dietary Notes", Required: false},
	}
}

func TestGetMyRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return rsvp state with schema for accepted application", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()
		mockSettings.On("GetRSVPSchema").Return(newRSVPSchema(), nil).Once()
		mockSettings.On("GetRSVPEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data RSVPResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPPending, envelope.Data.RSVPStatus)
		assert.True(t, envelope.Data.RSVPEnabled)
		assert.Len(t, envelope.Data.RSVPSchema, 2)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 403 when application is not accepted", func(t *testing.T) {
		user := newTestUser()
		submitted := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted}

		mockApps.On("GetByUserID", user.ID).Return(submitted, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when application does not exist", func(t *testing.T) {
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyRSVPHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestSubmitMyRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	newRequest := func(t *testing.T, body string, user *store.User) *http.Request {
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		return setUserContext(req, user)
	}

	t.Run("should confirm rsvp with valid responses", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()
		mockSettings.On("GetRSVPSchema").Return(newRSVPSchema(), nil).Once()
		mockApps.On("SubmitRSVP", mock.MatchedBy(func(a *store.Application) bool {
			return a.RSVPStatus == store.RSVPConfirmed
		})).Return(nil).Once()
		mockSettings.On("GetRSVPEnabled").Return(true, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed","responses":{"shirt_size":"M"}}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data RSVPResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPConfirmed, envelope.Data.RSVPStatus)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should decline rsvp without requiring responses", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()
		mockSettings.On("GetRSVPSchema").Return(newRSVPSchema(), nil).Once()
		mockApps.On("SubmitRSVP", mock.MatchedBy(func(a *store.Application) bool {
			return a.RSVPStatus == store.RSVPDeclined && string(a.RSVPResponses) == `{}`
		})).Return(nil).Once()
		mockSettings.On("GetRSVPEnabled").Return(true, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"declined"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when confirming without required fields", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()
		mockSettings.On("GetRSVPSchema").Return(newRSVPSchema(), nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed","responses":{}}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var body struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
		assert.Contains(t, body.Error, "shirt_size is required")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid rsvp status", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"maybe"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 403 when application is not accepted", func(t *testing.T) {
		user := newTestUser()
		waitlisted := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusWaitlisted}

		mockApps.On("GetByUserID", user.ID).Return(waitlisted, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when application does not exist", func(t *testing.T) {
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when rsvp already submitted", func(t *testing.T) {
		user := newTestUser()
		alreadyConfirmed := newAcceptedApplication(user.ID)
		alreadyConfirmed.RSVPStatus = store.RSVPConfirmed

		mockApps.On("GetByUserID", user.ID).Return(alreadyConfirmed, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"declined"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when store reports concurrent rsvp", func(t *testing.T) {
		user := newTestUser()
		accepted := newAcceptedApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(accepted, nil).Once()
		mockSettings.On("GetRSVPSchema").Return([]store.ApplicationSchemaField{}, nil).Once()
		mockApps.On("SubmitRSVP", mock.AnythingOfType("*store.Application")).Return(store.ErrConflict).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed"}`, user),
			http.HandlerFunc(app.submitMyRSVPHandler),
		)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}

func TestRSVPEnabledMiddleware(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("should return 401 when no user in context", func(t *testing.T) {
		app := newTestApplication(t)
		handler := app.RSVPEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 403 when rsvps are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).On("GetRSVPEnabled").Return(false, nil).Once()

		handler := app.RSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should allow access when rsvps are enabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).On("GetRSVPEnabled").Return(true, nil).Once()

		handler := app.RSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should allow super admin to bypass gate", func(t *testing.T) {
		app := newTestApplication(t)

		handler := app.RSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should return 500 on settings store error", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).On("GetRSVPEnabled").Return(false, assert.AnError).Once()

		handler := app.RSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestRSVPSchemaSettings(t *testing.T) {
	t.Run("should return rsvp schema", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetRSVPSchema").Return(newRSVPSchema(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getRSVPSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data RSVPSchemaResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Len(t, envelope.Data.Fields, 2)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should update rsvp schema", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateRSVPSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"shirt_size","type":"select","label":"Shirt Size","required":true,"options":["S","M"],"display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateRSVPSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject duplicate field ids", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"fields":[
			{"id":"shirt_size","type":"select","label":"A","display_order":0,"section_order":0},
			{"id":"shirt_size","type":"text","label":"B","display_order":1,"section_order":0}
		]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateRSVPSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should set rsvp enabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("SetRSVPEnabled", false).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"enabled":false}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setRSVPEnabled))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})
}

func TestResetApplicationRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should clear the rsvp and delete receipts detached by the cascade", func(t *testing.T) {
		// Resetting the spot also clears the travel RSVP underneath it, so the
		// receipts uploaded with that travel RSVP are no longer reachable.
		receiptPath := validTestReceiptPath("user-1")
		reset := newAcceptedApplication("user-1")

		mockApps.On("ResetRSVP", "app-1").Return(reset, []string{receiptPath}, nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, receiptPath).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPPending, envelope.Data.Application.RSVPStatus)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should still succeed when there are no receipts to delete", func(t *testing.T) {
		reset := newAcceptedApplication("user-1")
		mockApps.On("ResetRSVP", "app-1").Return(reset, nil, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		mockApps.On("ResetRSVP", "nonexistent").Return(nil, nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationRSVPHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}
