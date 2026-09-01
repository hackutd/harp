package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/store"
)

func newDecisionRecipient(appID, email string, status store.ApplicationStatus) store.DecisionEmailRecipient {
	firstName := "Ada"
	return store.DecisionEmailRecipient{
		ApplicationID: appID,
		UserID:        "user-" + appID,
		Email:         email,
		FirstName:     &firstName,
		Status:        status,
	}
}

// stubDecisionMailer registers loose expectations for the background sends.
// They fire in a goroutine, so they use .Maybe() and are never asserted.
func stubDecisionMailer(app *application) *mailer.MockClient {
	mockMailer := app.mailer.(*mailer.MockClient)
	mockMailer.On("SendDecisionEmail",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("mailer.Decision"),
	).Return(nil).Maybe()
	mockMailer.On("SendDecisionsReleasedEmail",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
	).Return(nil).Maybe()
	return mockMailer
}

func sendDecisionEmailsRequest(body string) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return setUserContext(req, newSuperAdminUser())
}

func TestSendDecisionEmails(t *testing.T) {
	t.Run("returns 200 and queues the selected statuses", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		stubDecisionMailer(app)

		pending := []store.DecisionEmailRecipient{
			newDecisionRecipient("app-1", "a@test.com", store.StatusAccepted),
			newDecisionRecipient("app-2", "b@test.com", store.StatusWaitlisted),
		}
		all := append(pending, newDecisionRecipient("app-3", "c@test.com", store.StatusAccepted))

		statuses := []store.ApplicationStatus{store.StatusAccepted, store.StatusWaitlisted}
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, true).
			Return(pending, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, false).
			Return(all, nil).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-1", "app-2"}, store.DecisionEmailKindDecision, true).
			Return(nil).Once()

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["accepted","waitlisted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendDecisionEmailsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, "decision", body.Data.Mode)
		assert.Equal(t, 2, body.Data.Queued)
		assert.Equal(t, 1, body.Data.Skipped)

		mockApps.AssertExpectations(t)
	})

	t.Run("announcement mode targets every decided applicant", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		stubDecisionMailer(app)

		pending := []store.DecisionEmailRecipient{
			newDecisionRecipient("app-1", "a@test.com", store.StatusRejected),
		}

		// The payload's statuses are deliberately ignored in announcement mode.
		mockApps.On("GetDecisionEmailRecipients", store.DecisionEmailStatuses, store.DecisionEmailKindAnnouncement, true).
			Return(pending, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", store.DecisionEmailStatuses, store.DecisionEmailKindAnnouncement, false).
			Return(pending, nil).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-1"}, store.DecisionEmailKindAnnouncement, true).
			Return(nil).Once()

		req := sendDecisionEmailsRequest(`{"mode":"announcement","statuses":["accepted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendDecisionEmailsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, "announcement", body.Data.Mode)
		assert.Equal(t, 1, body.Data.Queued)
		assert.Equal(t, 0, body.Data.Skipped)

		mockApps.AssertExpectations(t)
	})

	t.Run("resend_all includes applicants already emailed", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		stubDecisionMailer(app)

		all := []store.DecisionEmailRecipient{
			newDecisionRecipient("app-1", "a@test.com", store.StatusAccepted),
			newDecisionRecipient("app-2", "b@test.com", store.StatusAccepted),
		}

		statuses := []store.ApplicationStatus{store.StatusAccepted}
		// onlyUnsent=false, and no second call to compute skipped.
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, false).
			Return(all, nil).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-1", "app-2"}, store.DecisionEmailKindDecision, true).
			Return(nil).Once()

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["accepted"],"resend_all":true}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendDecisionEmailsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, 2, body.Data.Queued)
		assert.Equal(t, 0, body.Data.Skipped)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 200 and marks nothing when no one is pending", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		statuses := []store.ApplicationStatus{store.StatusAccepted}
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, true).
			Return([]store.DecisionEmailRecipient{}, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, false).
			Return([]store.DecisionEmailRecipient{
				newDecisionRecipient("app-1", "a@test.com", store.StatusAccepted),
			}, nil).Once()

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["accepted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SendDecisionEmailsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, 0, body.Data.Queued)
		assert.Equal(t, 1, body.Data.Skipped)

		mockApps.AssertNotCalled(t, "SetDecisionEmailSent", mock.Anything, mock.Anything, mock.Anything)
		mockApps.AssertExpectations(t)
	})

	t.Run("returns 400 for an unknown mode", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		req := sendDecisionEmailsRequest(`{"mode":"bogus","statuses":["accepted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 400 for a status that has no decision", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["submitted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 400 when decision mode has no statuses", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		req := sendDecisionEmailsRequest(`{"mode":"decision"}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 500 when fetching recipients fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		statuses := []store.ApplicationStatus{store.StatusAccepted}
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, true).
			Return(nil, assert.AnError).Once()

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["accepted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 500 without sending when the sent marker cannot be written", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		pending := []store.DecisionEmailRecipient{
			newDecisionRecipient("app-1", "a@test.com", store.StatusAccepted),
		}

		statuses := []store.ApplicationStatus{store.StatusAccepted}
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, true).
			Return(pending, nil).Once()
		mockApps.On("GetDecisionEmailRecipients", statuses, store.DecisionEmailKindDecision, false).
			Return(pending, nil).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-1"}, store.DecisionEmailKindDecision, true).
			Return(assert.AnError).Once()

		req := sendDecisionEmailsRequest(`{"mode":"decision","statuses":["accepted"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.sendDecisionEmailsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		// Nothing may go out if we could not record that it went out.
		mockMailer.AssertNotCalled(t, "SendDecisionEmail", mock.Anything, mock.Anything, mock.Anything)
		mockApps.AssertExpectations(t)
	})
}

func TestDispatchDecisionEmails(t *testing.T) {
	t.Run("clears the sent marker for failed sends", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		recipients := []store.DecisionEmailRecipient{
			newDecisionRecipient("app-1", "ok@test.com", store.StatusAccepted),
			newDecisionRecipient("app-2", "bad@test.com", store.StatusRejected),
		}

		mockMailer.On("SendDecisionEmail", "ok@test.com", "Ada", mailer.DecisionAccepted).
			Return(nil).Once()
		mockMailer.On("SendDecisionEmail", "bad@test.com", "Ada", mailer.DecisionRejected).
			Return(assert.AnError).Once()
		mockApps.On("SetDecisionEmailSent", []string{"app-2"}, store.DecisionEmailKindDecision, false).
			Return(nil).Once()

		// Called synchronously here so the assertions are deterministic.
		app.dispatchDecisionEmails(recipients, store.DecisionEmailKindDecision)

		mockMailer.AssertExpectations(t)
		mockApps.AssertExpectations(t)
	})

	t.Run("falls back to a generic name when first name is missing", func(t *testing.T) {
		app := newTestApplication(t)
		mockMailer := app.mailer.(*mailer.MockClient)

		recipients := []store.DecisionEmailRecipient{{
			ApplicationID: "app-1",
			UserID:        "user-1",
			Email:         "nameless@test.com",
			Status:        store.StatusWaitlisted,
		}}

		mockMailer.On("SendDecisionsReleasedEmail", "nameless@test.com", "Hacker").
			Return(nil).Once()

		app.dispatchDecisionEmails(recipients, store.DecisionEmailKindAnnouncement)

		mockMailer.AssertExpectations(t)
	})
}

func TestGetDecisionEmailStats(t *testing.T) {
	t.Run("returns 200 with per-status counts", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		stats := &store.DecisionEmailStats{
			Accepted:     store.EmailSendCounts{Total: 10, Sent: 4, Pending: 6},
			Waitlisted:   store.EmailSendCounts{Total: 5, Sent: 0, Pending: 5},
			Rejected:     store.EmailSendCounts{Total: 20, Sent: 20, Pending: 0},
			Announcement: store.EmailSendCounts{Total: 35, Sent: 1, Pending: 34},
		}
		mockApps.On("GetDecisionEmailStats").Return(stats, nil).Once()

		req, _ := http.NewRequest(http.MethodGet, "/", nil)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getDecisionEmailStatsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DecisionEmailStatsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		require.NotNil(t, body.Data.Stats)
		assert.Equal(t, int64(6), body.Data.Stats.Accepted.Pending)
		assert.Equal(t, int64(20), body.Data.Stats.Rejected.Sent)
		assert.Equal(t, int64(34), body.Data.Stats.Announcement.Pending)

		mockApps.AssertExpectations(t)
	})

	t.Run("returns 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockApps.On("GetDecisionEmailStats").Return(nil, assert.AnError).Once()

		req, _ := http.NewRequest(http.MethodGet, "/", nil)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getDecisionEmailStatsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockApps.AssertExpectations(t)
	})
}
