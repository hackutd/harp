package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPendingReviews(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)

	t.Run("should return pending reviews for admin", func(t *testing.T) {
		admin := newAdminUser()
		reviews := []store.ApplicationReviewWithDetails{
			{
				ApplicationReview: store.ApplicationReview{
					ID:            "rev-1",
					ApplicationID: "app-1",
					AdminID:       admin.ID,
				},
				Email: "applicant@test.com",
			},
		}

		mockReviews.On("GetPendingByAdminID", admin.ID).Return(reviews, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, admin)

		rr := executeRequest(req, http.HandlerFunc(app.getPendingReviews))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data PendingReviewsListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Reviews, 1)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should return empty list when no pending reviews", func(t *testing.T) {
		admin := newAdminUser()
		mockReviews.On("GetPendingByAdminID", admin.ID).Return([]store.ApplicationReviewWithDetails{}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, admin)

		rr := executeRequest(req, http.HandlerFunc(app.getPendingReviews))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockReviews.AssertExpectations(t)
	})
}

func TestGetCompletedReviews(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)

	t.Run("should return completed reviews for admin", func(t *testing.T) {
		admin := newAdminUser()
		vote := store.ReviewVoteAccept
		reviews := []store.ApplicationReviewWithDetails{
			{
				ApplicationReview: store.ApplicationReview{
					ID:      "rev-1",
					AdminID: admin.ID,
					Vote:    &vote,
				},
				Email: "applicant@test.com",
			},
		}

		mockReviews.On("GetCompletedByAdminID", admin.ID).Return(reviews, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, admin)

		rr := executeRequest(req, http.HandlerFunc(app.getCompletedReviews))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data CompletedReviewsListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Reviews, 1)

		mockReviews.AssertExpectations(t)
	})
}

func TestGetApplicationNotes(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)

	t.Run("should return notes for application", func(t *testing.T) {
		notes := []store.ReviewNote{
			{AdminID: "admin-1", AdminEmail: "admin@test.com", Notes: "Good applicant", CreatedAt: time.Now()},
		}

		mockReviews.On("GetNotesByApplicationID", "app-1").Return(notes, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.getApplicationNotes))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data NotesListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Notes, 1)

		mockReviews.AssertExpectations(t)
	})
}

func TestSubmitVote(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)

	t.Run("should submit a valid vote", func(t *testing.T) {
		admin := newAdminUser()
		review := &store.ApplicationReview{
			ID:            "rev-1",
			ApplicationID: "app-1",
			AdminID:       admin.ID,
		}

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, (*string)(nil)).Return(review, nil).Once()

		body := `{"vote":"accept"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should submit a vote with notes", func(t *testing.T) {
		admin := newAdminUser()
		notes := "Strong candidate"
		review := &store.ApplicationReview{
			ID:      "rev-1",
			AdminID: admin.ID,
			Notes:   &notes,
		}

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteReject, &notes).Return(review, nil).Once()

		body := `{"vote":"reject","notes":"Strong candidate"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid vote value", func(t *testing.T) {
		body := `{"vote":"maybe"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 404 when review not found", func(t *testing.T) {
		admin := newAdminUser()

		mockReviews.On("SubmitVote", "nonexistent", admin.ID, store.ReviewVoteAccept, (*string)(nil)).Return(nil, store.ErrNotFound).Once()

		body := `{"vote":"accept"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockReviews.AssertExpectations(t)
	})
}

func TestGetNextReview(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return next review assignment", func(t *testing.T) {
		admin := newAdminUser()
		review := &store.ApplicationReview{
			ID:            "rev-1",
			ApplicationID: "app-1",
			AdminID:       admin.ID,
		}

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("AssignNextForAdmin", admin.ID, 3).Return(review, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, admin)

		rr := executeRequest(req, http.HandlerFunc(app.getNextReview))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 404 when no applications need review", func(t *testing.T) {
		admin := newAdminUser()

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("AssignNextForAdmin", admin.ID, 3).Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, admin)

		rr := executeRequest(req, http.HandlerFunc(app.getNextReview))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}

func TestBatchAssignReviews(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should batch assign reviews", func(t *testing.T) {
		result := &store.BatchAssignmentResult{ReviewsCreated: 15}

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("BatchAssign", 3).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.batchAssignReviews))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data store.BatchAssignmentResult `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 15, body.Data.ReviewsCreated)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}
