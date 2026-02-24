package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type SubmitVotePayload struct {
	Vote  store.ReviewVote `json:"vote" validate:"required,oneof=accept reject waitlist"`
	Notes *string          `json:"notes" validate:"omitempty,max=1000"`
}

type ReviewResponse struct {
	Review store.ApplicationReview `json:"review"`
}

type PendingReviewsListResponse struct {
	Reviews []store.ApplicationReviewWithDetails `json:"reviews"`
}

type CompletedReviewsListResponse struct {
	Reviews []store.ApplicationReviewWithDetails `json:"reviews"`
}

type NotesListResponse struct {
	Notes []store.ReviewNote `json:"notes"`
}

// getPendingReviews returns all pending reviews assigned to the current admin
//
//	@Summary		Get pending reviews (Admin)
//	@Description	Returns all reviews assigned to the current admin that haven't been voted on yet, including application details
//	@Tags			admin
//	@Produce		json
//	@Success		200	{object}	PendingReviewsListResponse
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

	response := PendingReviewsListResponse{
		Reviews: reviews,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getCompletedReviews returns all reviews the current admin has completed
//
//	@Summary		Get completed reviews (Admin)
//	@Description	Returns all reviews the current admin has completed (voted on), including application details
//	@Tags			admin
//	@Produce		json
//	@Success		200	{object}	CompletedReviewsListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/reviews/completed [get]
func (app *application) getCompletedReviews(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	reviews, err := app.store.ApplicationReviews.GetCompletedByAdminID(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := CompletedReviewsListResponse{
		Reviews: reviews,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicationNotes returns all reviewer notes for a specific application
//
//	@Summary		Get notes for an application (Admin)
//	@Description	Returns all reviewer notes for a specific application without exposing votes
//	@Tags			admin
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	NotesListResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/{applicationID}/notes [get]
func (app *application) getApplicationNotes(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	notes, err := app.store.ApplicationReviews.GetNotesByApplicationID(r.Context(), applicationID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := NotesListResponse{
		Notes: notes,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// batchAssignReviews assigns submitted applications to admins using workload balancing
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

// getNextReview assigns and returns the next application needing review
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

// submitVote records the admin's vote on an assigned application review
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
