package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

// SubmitVotePayload for submitting a vote on a review
type SubmitVotePayload struct {
	Vote  store.ReviewVote `json:"vote" validate:"required,oneof=accept reject waitlist"`
	Notes *string          `json:"notes" validate:"omitempty,max=1000"`
}

// ReviewResponse wraps an application review for API response
type ReviewResponse struct {
	Review store.ApplicationReview `json:"review"`
}

// ReviewsListResponse wraps a list of application reviews for API response
type ReviewsListResponse struct {
	Reviews []store.ApplicationReview `json:"reviews"`
}

// getPendingReviews returns reviews assigned to the current admin that haven't been voted on yet
//
//	@Summary		Get pending reviews (Admin)
//	@Description	Returns all reviews assigned to the current admin that haven't been voted on yet
//	@Tags			admin
//	@Produce		json
//	@Success		200	{object}	ReviewsListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/reviews/pending [get]
func (app *application) getPendingReviews(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	reviews, err := app.store.ApplicationReviews.GetPendingByAdminID(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewsListResponse{
		Reviews: reviews,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicationReviews returns all reviews for a specific application
//
//	@Summary		Get reviews for an application (Admin)
//	@Description	Returns all reviews (pending and completed) for a specific application
//	@Tags			admin
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ReviewsListResponse
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/{applicationID}/reviews [get]
func (app *application) getApplicationReviews(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	reviews, err := app.store.ApplicationReviews.GetByApplicationID(r.Context(), applicationID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewsListResponse{
		Reviews: reviews,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// batchAssignReviews assigns reviews to admins for all submitted applications needing reviews
//
//	@Summary		Batch assign reviews (SuperAdmin)
//	@Description	Finds all submitted applications needing more reviews and assigns them to admins using workload balancing
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	store.BatchAssignmentResult
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/assign [post]
func (app *application) batchAssignReviews(w http.ResponseWriter, r *http.Request) {
	reviewsPerApp, err := app.store.Settings.GetReviewsPerApplication(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	result, err := app.store.ApplicationReviews.BatchAssign(r.Context(), reviewsPerApp)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, result); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getNextReview assigns and returns the next unreviewed application for the current admin
//
//	@Summary		Get next review assignment (Admin)
//	@Description	Automatically assigns the next submitted application needing review to the current admin and returns it
//	@Tags			admin
//	@Produce		json
//	@Success		200	{object}	ReviewResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}	"No applications need review"
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/reviews/next [get]
func (app *application) getNextReview(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	reviewsPerApp, err := app.store.Settings.GetReviewsPerApplication(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	review, err := app.store.ApplicationReviews.AssignNextForAdmin(r.Context(), user.ID, reviewsPerApp)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("no applications need review"))
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	response := ReviewResponse{
		Review: *review,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// submitVote records an admin's vote on an assigned review
//
//	@Summary		Submit vote on a review (Admin)
//	@Description	Records the admin's vote (accept/reject/waitlist) on an assigned application review
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			reviewID	path		string				true	"Review ID"
//	@Param			vote		body		SubmitVotePayload	true	"Vote and optional notes"
//	@Success		200			{object}	ReviewResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/reviews/{reviewID} [put]
func (app *application) submitVote(w http.ResponseWriter, r *http.Request) {
	reviewID := chi.URLParam(r, "reviewID")
	if reviewID == "" {
		app.badRequestResponse(w, r, errors.New("review ID is required"))
		return
	}

	user := getUserFromContext(r.Context())

	var req SubmitVotePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	review, err := app.store.ApplicationReviews.SubmitVote(r.Context(), reviewID, user.ID, req.Vote, req.Notes)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, err)
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	response := ReviewResponse{
		Review: *review,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
