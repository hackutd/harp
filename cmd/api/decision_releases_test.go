package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newDecidedApplication returns an application carrying a final decision,
// travel decision, and the review votes behind them, none of it released.
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

// markReleased copies the application's current decisions into its released
// fields, as a decision release covering it would.
func markReleased(a *store.Application) *store.Application {
	status := a.Status
	a.ReleasedStatus = &status
	if a.TravelStatus == store.TravelApproved || a.TravelStatus == store.TravelRejected {
		travel := a.TravelStatus
		a.ReleasedTravelStatus = &travel
		if travel == store.TravelApproved && a.TravelApprovedAmountCents != nil {
			amount := *a.TravelApprovedAmountCents
			a.ReleasedTravelAmountCents = &amount
		}
	}
	now := time.Now()
	a.DecisionReleasedAt = &now
	return a
}

// rerelease releases the application's current decisions again, replacing
// whatever was released before.
func rerelease(a *store.Application) *store.Application {
	a.ReleasedStatus, a.ReleasedTravelStatus, a.ReleasedTravelAmountCents = nil, nil, nil
	return markReleased(a)
}

func TestShowReleasedDecision(t *testing.T) {
	for _, status := range []store.ApplicationStatus{store.StatusAccepted, store.StatusRejected, store.StatusWaitlisted} {
		t.Run("shows an unreleased "+string(status)+" as submitted", func(t *testing.T) {
			application := newDecidedApplication("user-1", status)

			showReleasedDecision(application)

			assert.Equal(t, store.StatusSubmitted, application.Status)
			assert.Equal(t, store.TravelPending, application.TravelStatus)
			assert.Nil(t, application.TravelApprovedAmountCents)
		})

		t.Run("shows a released "+string(status), func(t *testing.T) {
			application := markReleased(newDecidedApplication("user-1", status))

			showReleasedDecision(application)

			assert.Equal(t, status, application.Status)
			assert.Equal(t, store.TravelApproved, application.TravelStatus)
			require.NotNil(t, application.TravelApprovedAmountCents)
			assert.Equal(t, int64(15000), *application.TravelApprovedAmountCents)
		})
	}

	t.Run("keeps showing the released decision after it is changed", func(t *testing.T) {
		application := markReleased(newDecidedApplication("user-1", store.StatusWaitlisted))
		application.Status = store.StatusAccepted
		application.TravelStatus = store.TravelRejected
		application.TravelApprovedAmountCents = nil

		showReleasedDecision(application)

		assert.Equal(t, store.StatusWaitlisted, application.Status)
		assert.Equal(t, store.TravelApproved, application.TravelStatus)
		require.NotNil(t, application.TravelApprovedAmountCents)
	})

	t.Run("keeps a released decision moved back to submitted", func(t *testing.T) {
		application := markReleased(newDecidedApplication("user-1", store.StatusAccepted))
		application.Status = store.StatusSubmitted

		showReleasedDecision(application)

		assert.Equal(t, store.StatusAccepted, application.Status)
	})

	t.Run("hides a travel decision released before travel was decided", func(t *testing.T) {
		application := newDecidedApplication("user-1", store.StatusAccepted)
		application.TravelStatus = store.TravelPending
		application.TravelApprovedAmountCents = nil
		markReleased(application)
		application.TravelStatus = store.TravelRejected

		showReleasedDecision(application)

		assert.Equal(t, store.StatusAccepted, application.Status)
		assert.Equal(t, store.TravelPending, application.TravelStatus)
	})

	t.Run("always withholds votes and the released copies", func(t *testing.T) {
		application := markReleased(newDecidedApplication("user-1", store.StatusAccepted))

		showReleasedDecision(application)

		assert.Zero(t, application.AcceptVotes)
		assert.Zero(t, application.RejectVotes)
		assert.Zero(t, application.WaitlistVotes)
		assert.Zero(t, application.TravelYesVotes)
		assert.Zero(t, application.TravelNoVotes)
		assert.Nil(t, application.ReleasedStatus)
		assert.Nil(t, application.ReleasedTravelStatus)
		assert.Nil(t, application.ReleasedTravelAmountCents)
		assert.Nil(t, application.DecisionReleasedAt)
	})

	for _, status := range []store.ApplicationStatus{store.StatusDraft, store.StatusSubmitted} {
		t.Run("leaves an undecided "+string(status)+" as is", func(t *testing.T) {
			application := &store.Application{Status: status, TravelStatus: store.TravelPending}

			showReleasedDecision(application)

			assert.Equal(t, status, application.Status)
			assert.Equal(t, store.TravelPending, application.TravelStatus)
		})
	}
}

func TestDecisionGateOnHackerEndpoints(t *testing.T) {
	getApplication := func(t *testing.T, application *store.Application) map[string]any {
		t.Helper()
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockApps.On("GetByUserID", application.UserID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return([]store.ApplicationSchemaField{}, nil).Once()
		mockScans.On("GetTotalPointsByUserID", application.UserID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, &store.User{ID: application.UserID, Role: store.RoleHacker})

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data map[string]any `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		return envelope.Data
	}

	t.Run("GET /applications/me reports submitted until released", func(t *testing.T) {
		data := getApplication(t, newDecidedApplication("user-1", store.StatusAccepted))

		assert.Equal(t, "submitted", data["status"])
		assert.Equal(t, "pending", data["travel_status"])
		assert.EqualValues(t, 0, data["accept_votes"])
	})

	t.Run("GET /applications/me reports the released decision, not a later change", func(t *testing.T) {
		application := markReleased(newDecidedApplication("user-1", store.StatusWaitlisted))
		application.Status = store.StatusAccepted

		data := getApplication(t, application)

		assert.Equal(t, "waitlisted", data["status"])
		assert.NotContains(t, data, "released_status")
	})

	t.Run("GET /applications/me/rsvp returns 403 until the acceptance is released", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		unreleased := newAcceptedApplication(user.ID)
		unreleased.ReleasedStatus = nil
		mockApps.On("GetByUserID", user.ID).Return(unreleased, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockSettings.AssertNotCalled(t, "GetRSVPSchema")
	})

	t.Run("POST /applications/me/rsvp returns 403 and saves nothing until released", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		user := newTestUser()

		unreleased := newAcceptedApplication(user.ID)
		unreleased.ReleasedStatus = nil
		mockApps.On("GetByUserID", user.ID).Return(unreleased, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"status":"declined"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitMyRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertNotCalled(t, "SubmitRSVP", mock.Anything)
	})

	t.Run("GET /applications/me/travel-rsvp returns 403 until released", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		user := newTestUser()

		eligible := newDecidedApplication(user.ID, store.StatusAccepted)
		eligible.RSVPStatus = store.RSVPConfirmed
		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})
}

func createReleaseRequest(body string) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return setUserContext(req, newSuperAdminUser())
}

func TestCreateDecisionRelease(t *testing.T) {
	deadline := time.Date(2026, 10, 3, 23, 59, 59, 999_000_000, time.FixedZone("CDT", -5*60*60))
	statuses := []store.ApplicationStatus{store.StatusAccepted, store.StatusWaitlisted}

	t.Run("releases the priority audience against the deadline", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)

		mockSettings.On("GetPriorityDeadline").Return(&deadline, nil).Once()
		mockReleases.On("Create", store.DecisionReleaseFilter{
			Audience: store.AudiencePriority, Statuses: statuses, PriorityDeadline: &deadline,
		}, mock.AnythingOfType("string")).Return(&store.DecisionRelease{ID: "rel-1", ReleasedCount: 629}, nil).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"priority","statuses":["accepted","waitlisted"]}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var envelope struct {
			Data CreateDecisionReleaseResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, 629, envelope.Data.Release.ReleasedCount)
		assert.Nil(t, envelope.Data.Emails)
		mockReleases.AssertExpectations(t)
	})

	t.Run("releases everyone without reading the deadline", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)

		mockReleases.On("Create", store.DecisionReleaseFilter{
			Audience: store.AudienceEveryone, Statuses: []store.ApplicationStatus{store.StatusRejected},
		}, mock.AnythingOfType("string")).Return(&store.DecisionRelease{ID: "rel-1", ReleasedCount: 1}, nil).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"everyone","statuses":["rejected"],"email":"none"}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockSettings.AssertNotCalled(t, "GetPriorityDeadline")
	})

	t.Run("returns 400 for a priority release without a deadline", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockSettings.On("GetPriorityDeadline").Return(nil, nil).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"non_priority","statuses":["accepted"]}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		mockReleases.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
	})

	t.Run("returns 409 when nothing would change", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockReleases.On("Create", mock.Anything, mock.Anything).Return(nil, store.ErrNothingToRelease).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"everyone","statuses":["accepted"]}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)
	})

	for name, body := range map[string]string{
		"no statuses":         `{"audience":"everyone","statuses":[]}`,
		"an undecided status": `{"audience":"everyone","statuses":["submitted"]}`,
		"an unknown audience": `{"audience":"vip","statuses":["accepted"]}`,
		"an unknown email":    `{"audience":"everyone","statuses":["accepted"],"email":"sms"}`,
	} {
		t.Run("returns 400 for "+name, func(t *testing.T) {
			app := newTestApplication(t)
			rr := executeRequest(createReleaseRequest(body), http.HandlerFunc(app.createDecisionReleaseHandler))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
		})
	}

	t.Run("emails each applicant in the release their decision", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		mockReleases.On("Create", mock.Anything, mock.Anything).Return(&store.DecisionRelease{ID: "rel-1", ReleasedCount: 1}, nil).Once()
		recipients := []store.DecisionEmailRecipient{{ApplicationID: "app-1", UserID: "user-1", Email: "a@example.com", Status: store.StatusAccepted}}
		mockApps.On("GetDecisionEmailRecipients", []store.ApplicationStatus{store.StatusAccepted}, store.DecisionEmailKindDecision, true, "rel-1").Return(recipients, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", []store.ApplicationStatus{store.StatusAccepted}, store.DecisionEmailKindDecision, false, "rel-1").Return(recipients, nil).Once()
		mockMailer.On("SendDecisionEmail", "a@example.com", "Hacker", mock.Anything).Return(nil).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-1"}, store.DecisionEmailKindDecision, true).Return(nil).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"everyone","statuses":["accepted"],"email":"decision"}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		app.backgroundJobs.Wait()

		var envelope struct {
			Data CreateDecisionReleaseResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		require.NotNil(t, envelope.Data.Emails)
		assert.Equal(t, 1, envelope.Data.Emails.Queued)
		mockApps.AssertExpectations(t)
		mockMailer.AssertExpectations(t)
	})

	t.Run("announces to every decision in the release", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)

		mockReleases.On("Create", mock.Anything, mock.Anything).Return(&store.DecisionRelease{ID: "rel-1", ReleasedCount: 1}, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", store.DecisionEmailStatuses, store.DecisionEmailKindAnnouncement, true, "rel-1").Return([]store.DecisionEmailRecipient{}, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", store.DecisionEmailStatuses, store.DecisionEmailKindAnnouncement, false, "rel-1").Return([]store.DecisionEmailRecipient{}, nil).Once()

		rr := executeRequest(createReleaseRequest(`{"audience":"everyone","statuses":["accepted"],"email":"announcement"}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockApps.AssertExpectations(t)
	})

	t.Run("returns 409 and releases nothing while emails are still sending", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		app.decisionEmailInFlight.Store(true)

		rr := executeRequest(createReleaseRequest(`{"audience":"everyone","statuses":["accepted"],"email":"decision"}`),
			http.HandlerFunc(app.createDecisionReleaseHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)
		mockReleases.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
	})
}

func TestPreviewDecisionRelease(t *testing.T) {
	t.Run("returns the per-status breakdown for the audience", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		preview := &store.DecisionReleasePreview{
			ByStatus: map[store.ApplicationStatus]store.DecisionReleaseCounts{
				store.StatusAccepted: {New: 570, Changed: 6, RSVPChanged: 2},
			},
			UnderReview: 1063,
		}
		mockReleases.On("Preview", store.DecisionReleaseFilter{Audience: store.AudienceEveryone}).Return(preview, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?audience=everyone", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.previewDecisionReleaseHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data DecisionReleasePreviewResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, 1063, envelope.Data.Preview.UnderReview)
		assert.Equal(t, 576, envelope.Data.Preview.ByStatus[store.StatusAccepted].Releasable())
	})

	t.Run("returns 400 for an unknown audience", func(t *testing.T) {
		app := newTestApplication(t)
		req, err := http.NewRequest(http.MethodGet, "/?audience=vip", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.previewDecisionReleaseHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUndoDecisionRelease(t *testing.T) {
	undo := func(app *application) int {
		req, _ := http.NewRequest(http.MethodPost, "/", nil)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("releaseID", "rel-1")
		req = setUserContext(req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx)), newSuperAdminUser())
		return executeRequest(req, http.HandlerFunc(app.undoDecisionReleaseHandler)).Code
	}

	t.Run("undoes the latest release and returns the list", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockReleases.On("Undo", "rel-1", mock.AnythingOfType("string")).Return(nil).Once()
		mockReleases.On("List").Return([]store.DecisionRelease{{ID: "rel-1"}}, nil).Once()

		assert.Equal(t, http.StatusOK, undo(app))
		mockReleases.AssertExpectations(t)
	})

	t.Run("returns 409 for an older release", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockReleases.On("Undo", "rel-1", mock.Anything).Return(store.ErrNotLatestRelease).Once()

		assert.Equal(t, http.StatusConflict, undo(app))
	})

	t.Run("returns 404 for an unknown release", func(t *testing.T) {
		app := newTestApplication(t)
		mockReleases := app.store.DecisionReleases.(*store.MockDecisionReleasesStore)
		mockReleases.On("Undo", "rel-1", mock.Anything).Return(store.ErrNotFound).Once()

		assert.Equal(t, http.StatusNotFound, undo(app))
	})
}
