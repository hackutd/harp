package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
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

func TestGetReviewLeaderboard(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)

	t.Run("should return reviewers ranked by completed reviews", func(t *testing.T) {
		reviewers := []store.ReviewerStats{
			{AdminID: "admin-1", Email: "a@test.com", Role: store.RoleAdmin, Rank: 1, Completed: 12, Pending: 0},
			{AdminID: "admin-2", Email: "b@test.com", Role: store.RoleSuperAdmin, Rank: 2, Completed: 7, Pending: 3},
		}
		mockReviews.On("GetLeaderboard").Return(reviewers, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getReviewLeaderboard))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReviewLeaderboardResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, reviewers, body.Data.Reviewers)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should return 500 when the store fails", func(t *testing.T) {
		mockReviews.On("GetLeaderboard").Return(nil, errors.New("db down")).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getReviewLeaderboard))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

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

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, (*bool)(nil), (*string)(nil)).Return(review, nil).Once()

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

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteReject, (*bool)(nil), &notes).Return(review, nil).Once()

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

	t.Run("should submit a travel vote when applicant requested travel", func(t *testing.T) {
		admin := newAdminUser()
		travelYes := true
		review := &store.ApplicationReview{
			ID:            "rev-1",
			ApplicationID: "app-1",
			AdminID:       admin.ID,
			TravelVote:    &travelYes,
		}

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, &travelYes, (*string)(nil)).Return(review, nil).Once()

		body := `{"vote":"accept","travel_vote":true}`
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

	t.Run("should replace an existing vote", func(t *testing.T) {
		admin := newAdminUser()
		travelNo := false
		notes := "Changed my mind after re-reading"
		reviewedAt := time.Now()
		vote := store.ReviewVoteWaitlist
		review := &store.ApplicationReview{
			ID:            "rev-1",
			ApplicationID: "app-1",
			AdminID:       admin.ID,
			Vote:          &vote,
			TravelVote:    &travelNo,
			Notes:         &notes,
			ReviewedAt:    &reviewedAt,
		}

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteWaitlist, &travelNo, &notes).Return(review, nil).Once()

		body := `{"vote":"waitlist","travel_vote":false,"notes":"Changed my mind after re-reading"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data ReviewResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		require.NotNil(t, resp.Data.Review.Vote)
		assert.Equal(t, store.ReviewVoteWaitlist, *resp.Data.Review.Vote)
		require.NotNil(t, resp.Data.Review.TravelVote)
		assert.False(t, *resp.Data.Review.TravelVote)
		require.NotNil(t, resp.Data.Review.Notes)
		assert.Equal(t, notes, *resp.Data.Review.Notes)
		assert.NotNil(t, resp.Data.Review.ReviewedAt)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should return 400 when travel vote missing but applicant requested travel", func(t *testing.T) {
		admin := newAdminUser()

		// The UPDATE's own predicate rejects the vote; the follow-up read is
		// what turns "no row" into the specific 400.
		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, (*bool)(nil), (*string)(nil)).Return(nil, store.ErrVoteNotApplied).Once()
		mockReviews.On("GetTravelStatusByReviewID", "rev-1", admin.ID).Return(store.TravelPending, nil).Once()

		body := `{"vote":"accept"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockReviews.AssertExpectations(t)
	})

	t.Run("should return 400 when travel vote provided but applicant did not request travel", func(t *testing.T) {
		admin := newAdminUser()
		travelNo := false

		mockReviews.On("SubmitVote", "rev-1", admin.ID, store.ReviewVoteAccept, &travelNo, (*string)(nil)).Return(nil, store.ErrVoteNotApplied).Once()
		mockReviews.On("GetTravelStatusByReviewID", "rev-1", admin.ID).Return(store.TravelNotRequested, nil).Once()

		body := `{"vote":"accept","travel_vote":false}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, admin)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("reviewID", "rev-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.submitVote))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

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

		mockReviews.On("SubmitVote", "nonexistent", admin.ID, store.ReviewVoteAccept, (*bool)(nil), (*string)(nil)).Return(nil, store.ErrVoteNotApplied).Once()
		mockReviews.On("GetTravelStatusByReviewID", "nonexistent", admin.ID).Return(store.TravelStatus(""), store.ErrNotFound).Once()

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

func TestClaimReviews(t *testing.T) {
	newClaimTest := func(t *testing.T) (*application, *store.MockApplicationReviewsStore, *store.MockSettingsStore) {
		app := newTestApplication(t)
		return app,
			app.store.ApplicationReviews.(*store.MockApplicationReviewsStore),
			app.store.Settings.(*store.MockSettingsStore)
	}
	claim := func(t *testing.T, app *application, user *store.User) *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)
		return executeRequest(req, http.HandlerFunc(app.claimReviews))
	}
	queue := func(adminID string, n int) []store.ApplicationReviewWithDetails {
		reviews := []store.ApplicationReviewWithDetails{}
		for i := range n {
			reviews = append(reviews, store.ApplicationReviewWithDetails{
				ApplicationReview: store.ApplicationReview{
					ID:            fmt.Sprintf("rev-%d", i),
					ApplicationID: fmt.Sprintf("app-%d", i),
					AdminID:       adminID,
				},
				Email: "applicant@test.com",
			})
		}
		return reviews
	}

	t.Run("should claim reviews and return the new queue", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		admin := newAdminUser()

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("ClaimForAdmin", admin.ID, 3, reviewClaimBatchSize).Return(2, nil).Once()
		mockReviews.On("GetPendingByAdminID", admin.ID).Return(queue(admin.ID, 2), nil).Once()

		rr := claim(t, app, admin)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ClaimReviewsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, 2, body.Data.Claimed)
		assert.Len(t, body.Data.Reviews, 2)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return an empty queue when nothing can be claimed", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		admin := newAdminUser()

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("ClaimForAdmin", admin.ID, 3, reviewClaimBatchSize).Return(0, nil).Once()
		mockReviews.On("GetPendingByAdminID", admin.ID).Return(queue(admin.ID, 0), nil).Once()

		rr := claim(t, app, admin)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ClaimReviewsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, 0, body.Data.Claimed)
		assert.NotNil(t, body.Data.Reviews)
		assert.Empty(t, body.Data.Reviews)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 409 while the admin still has pending reviews", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		admin := newAdminUser()

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("ClaimForAdmin", admin.ID, 3, reviewClaimBatchSize).Return(0, store.ErrConflict).Once()

		rr := claim(t, app, admin)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		var body struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Contains(t, body.Error, "finish your assigned reviews")

		mockReviews.AssertNotCalled(t, "GetPendingByAdminID", admin.ID)
		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 403 for a super admin with assignment disabled", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		superAdmin := newSuperAdminUser()

		mockSettings.On("GetReviewAssignmentToggle", superAdmin.ID).Return(false, nil).Once()

		rr := claim(t, app, superAdmin)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		var body struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Contains(t, body.Error, "review assignment is turned off")

		mockSettings.AssertNotCalled(t, "GetReviewsPerApplication")
		mockReviews.AssertNotCalled(t, "ClaimForAdmin", superAdmin.ID, 3, reviewClaimBatchSize)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should let a super admin with assignment enabled claim", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		superAdmin := newSuperAdminUser()

		mockSettings.On("GetReviewAssignmentToggle", superAdmin.ID).Return(true, nil).Once()
		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("ClaimForAdmin", superAdmin.ID, 3, reviewClaimBatchSize).Return(5, nil).Once()
		mockReviews.On("GetPendingByAdminID", superAdmin.ID).Return(queue(superAdmin.ID, 5), nil).Once()

		rr := claim(t, app, superAdmin)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 500 when the claim fails", func(t *testing.T) {
		app, mockReviews, mockSettings := newClaimTest(t)
		admin := newAdminUser()

		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()
		mockReviews.On("ClaimForAdmin", admin.ID, 3, reviewClaimBatchSize).Return(0, errors.New("db down")).Once()

		rr := claim(t, app, admin)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockReviews.AssertNotCalled(t, "GetPendingByAdminID", admin.ID)
		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}

func TestBatchAssignReviews(t *testing.T) {
	app := newTestApplication(t)
	mockReviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should batch assign reviews", func(t *testing.T) {
		result := &store.BatchAssignmentResult{ReviewsCreated: 15, ReviewsRemoved: 2, ReviewsPerApplication: 3, ApplicationsBelowTarget: 1, ReviewsUnfilled: 2}

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
		assert.Equal(t, *result, body.Data)

		mockReviews.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}
