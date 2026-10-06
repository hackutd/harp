package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newDecidedApplication returns an application carrying a final decision,
// travel decision, and the review votes behind them.
func newDecidedApplication(userID string, status store.ApplicationStatus) *store.Application {
	amount := int64(15000)
	return &store.Application{
		ID:                        "app-1",
		UserID:                    userID,
		Status:                    status,
		AcceptVotes:               3,
		RejectVotes:               1,
		WaitlistVotes:             1,
		TravelStatus:              store.TravelApproved,
		TravelYesVotes:            2,
		TravelNoVotes:             1,
		TravelApprovedAmountCents: &amount,
		RSVPStatus:                store.RSVPPending,
	}
}

func TestHideUnreleasedDecision(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "/", nil)
	require.NoError(t, err)

	for _, status := range []store.ApplicationStatus{store.StatusAccepted, store.StatusRejected, store.StatusWaitlisted} {
		t.Run("masks "+string(status)+" while unreleased", func(t *testing.T) {
			app := newTestApplication(t)
			stubDecisionsReleased(app, false)
			application := newDecidedApplication("user-1", status)

			require.NoError(t, app.hideUnreleasedDecision(req, application))

			assert.Equal(t, store.StatusSubmitted, application.Status)
			assert.Equal(t, store.TravelPending, application.TravelStatus)
			assert.Zero(t, application.AcceptVotes)
			assert.Zero(t, application.RejectVotes)
			assert.Zero(t, application.WaitlistVotes)
			assert.Zero(t, application.TravelYesVotes)
			assert.Zero(t, application.TravelNoVotes)
			assert.Nil(t, application.TravelApprovedAmountCents)
		})

		t.Run("leaves "+string(status)+" untouched once released", func(t *testing.T) {
			app := newTestApplication(t)
			stubDecisionsReleased(app, true)
			application := newDecidedApplication("user-1", status)

			require.NoError(t, app.hideUnreleasedDecision(req, application))

			assert.Equal(t, newDecidedApplication("user-1", status), application)
		})
	}

	t.Run("masks a travel decision on an undecided application", func(t *testing.T) {
		app := newTestApplication(t)
		stubDecisionsReleased(app, false)
		application := &store.Application{Status: store.StatusSubmitted, TravelStatus: store.TravelRejected}

		require.NoError(t, app.hideUnreleasedDecision(req, application))

		assert.Equal(t, store.StatusSubmitted, application.Status)
		assert.Equal(t, store.TravelPending, application.TravelStatus)
	})

	for _, status := range []store.ApplicationStatus{store.StatusDraft, store.StatusSubmitted} {
		t.Run("skips the setting lookup for "+string(status), func(t *testing.T) {
			app := newTestApplication(t)
			mockSettings := app.store.Settings.(*store.MockSettingsStore)
			application := &store.Application{Status: status, TravelStatus: store.TravelPending}

			require.NoError(t, app.hideUnreleasedDecision(req, application))

			assert.Equal(t, status, application.Status)
			mockSettings.AssertNotCalled(t, "GetDecisionsReleased")
		})
	}

	t.Run("returns the store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetDecisionsReleased").Return(false, assert.AnError).Once()

		err := app.hideUnreleasedDecision(req, newDecidedApplication("user-1", store.StatusAccepted))

		assert.ErrorIs(t, err, assert.AnError)
	})
}

func TestDecisionGateOnHackerEndpoints(t *testing.T) {
	t.Run("GET /applications/me reports submitted while unreleased", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(newDecidedApplication(user.ID, store.StatusAccepted), nil).Once()
		mockSettings.On("GetDecisionsReleased").Return(false, nil).Once()
		mockSettings.On("GetApplicationSchema").Return([]store.ApplicationSchemaField{}, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				Status       store.ApplicationStatus `json:"status"`
				TravelStatus store.TravelStatus      `json:"travel_status"`
				AcceptVotes  int                     `json:"accept_votes"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.StatusSubmitted, envelope.Data.Status)
		assert.Equal(t, store.TravelPending, envelope.Data.TravelStatus)
		assert.Zero(t, envelope.Data.AcceptVotes)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("GET /applications/me returns 500 when the setting cannot be read", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(newDecidedApplication(user.ID, store.StatusAccepted), nil).Once()
		mockSettings.On("GetDecisionsReleased").Return(false, assert.AnError).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("GET /applications/me/rsvp returns 403 while unreleased", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(newAcceptedApplication(user.ID), nil).Once()
		mockSettings.On("GetDecisionsReleased").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockSettings.AssertNotCalled(t, "GetRSVPSchema")
	})

	t.Run("POST /applications/me/rsvp returns 403 and saves nothing while unreleased", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(newAcceptedApplication(user.ID), nil).Once()
		mockSettings.On("GetDecisionsReleased").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"status":"declined"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitMyRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertNotCalled(t, "SubmitRSVP", mock.Anything)
	})

	t.Run("GET /applications/me/travel-rsvp returns 403 while unreleased", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		eligible := newDecidedApplication(user.ID, store.StatusAccepted)
		eligible.RSVPStatus = store.RSVPConfirmed
		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetDecisionsReleased").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})
}

func TestDecisionsReleasedSettings(t *testing.T) {
	t.Run("should return the release state", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetDecisionsReleased").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getDecisionsReleased))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data DecisionsReleasedResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.True(t, envelope.Data.Released)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetDecisionsReleased").Return(false, assert.AnError).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getDecisionsReleased))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})

	for _, released := range []bool{true, false} {
		t.Run("should set released to "+strconv.FormatBool(released), func(t *testing.T) {
			app := newTestApplication(t)
			mockSettings := app.store.Settings.(*store.MockSettingsStore)
			mockSettings.On("SetDecisionsReleased", released).Return(nil).Once()

			body := `{"released":false}`
			if released {
				body = `{"released":true}`
			}
			req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			req = setUserContext(req, newSuperAdminUser())

			rr := executeRequest(req, http.HandlerFunc(app.setDecisionsReleased))
			checkResponseCode(t, http.StatusOK, rr.Code)

			var envelope struct {
				Data DecisionsReleasedResponse `json:"data"`
			}
			require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
			assert.Equal(t, released, envelope.Data.Released)
			mockSettings.AssertExpectations(t)
		})
	}

	t.Run("should return 400 for a malformed body", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"released":"yes"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setDecisionsReleased))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		mockSettings.AssertNotCalled(t, "SetDecisionsReleased", mock.Anything)
	})

	t.Run("should return 500 when the store fails to save", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("SetDecisionsReleased", true).Return(assert.AnError).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"released":true}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setDecisionsReleased))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}
