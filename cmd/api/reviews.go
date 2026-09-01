package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
)

type SubmitVotePayload struct {
	Vote       store.ReviewVote `json:"vote" validate:"required,oneof=accept reject waitlist"`
	TravelVote *bool            `json:"travel_vote"`
	Notes      *string          `json:"notes" validate:"omitempty,max=1000"`
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

type SetAIPercentPayload struct {
	AIPercent int16 `json:"ai_percent" validate:"min=0,max=100"`
}

type AIPercentResponse struct {
	AIPercent int16 `json:"ai_percent"`
}

// getPendingReviews returns reviews assigned to the current admin that haven't been voted on yet
//
//	@Summary		Get pending reviews (Admin)
//	@Description	Returns all reviews assigned to the current admin that haven't been voted on yet, including application details
//	@Tags			admin/reviews
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
//	@Tags			admin/reviews
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
//	@Tags			admin/applications
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
//	@Tags			superadmin/applications
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
//	@Tags			admin/reviews
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
//	@Description	Records the admin's vote (accept/reject/waitlist) on an assigned application review. A travel_vote (yes/no) is required when the applicant requested travel reimbursement and must be omitted otherwise.
//	@Tags			admin/reviews
//	@Accept			json
//	@Produce		json
//	@Param			reviewID	path		string				true	"Review ID"
//	@Param			vote		body		SubmitVotePayload	true	"Vote, optional travel vote, and optional notes"
//	@Success		200			{object}	ReviewResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}
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

	// SubmitVote checks the travel agreement in the UPDATE itself, so a valid
	// vote costs one query. Only a rejected one pays a second to work out
	// whether the review was missing or the travel vote was wrong.
	review, err := app.store.ApplicationReviews.SubmitVote(r.Context(), reviewID, user.ID, req.Vote, req.TravelVote, req.Notes)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrVoteNotApplied):
			app.explainRejectedVote(w, r, reviewID, user.ID, req.TravelVote)
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

// explainRejectedVote turns a vote that matched no row into the right response.
// The UPDATE cannot say which of the two reasons applied, so this re-reads the
// travel status -- scoped to the admin, so it doubles as the ownership check
// that decides 404 versus 400.
func (app *application) explainRejectedVote(w http.ResponseWriter, r *http.Request, reviewID, adminID string, travelVote *bool) {
	travelStatus, err := app.store.ApplicationReviews.GetTravelStatusByReviewID(r.Context(), reviewID, adminID)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, err)
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	if travelStatus == store.TravelNotRequested && travelVote != nil {
		app.badRequestResponse(w, r, errors.New("travel_vote is not allowed: applicant did not request travel reimbursement"))
		return
	}
	if travelStatus != store.TravelNotRequested && travelVote == nil {
		app.badRequestResponse(w, r, errors.New("travel_vote is required: applicant requested travel reimbursement"))
		return
	}

	// The review exists and the travel vote agrees with it, so the row must
	// have changed underneath us between the update and this read.
	app.conflictResponse(w, r, errors.New("vote could not be recorded, please retry"))
}

// setAIPercent records the AI-generated content percent for an assigned application review
//
//	@Summary		Set AI percent on a review (Admin)
//	@Description	Records the estimated AI-generated content percent for an application assigned to the current admin
//	@Tags			admin/applications
//	@Accept			json
//	@Produce		json
//	@Param			applicationID	path		string				true	"Application ID"
//	@Param			payload			body		SetAIPercentPayload	true	"AI percent (0–100)"
//	@Success		200				{object}	AIPercentResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/{applicationID}/ai-percent [put]
func (app *application) setAIPercent(w http.ResponseWriter, r *http.Request) {

	applicationID := chi.URLParam(r, "applicationID")

	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	user := getUserFromContext(r.Context())

	var req SetAIPercentPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	err := app.store.ApplicationReviews.SetAIPercent(r.Context(), applicationID, user.ID, req.AIPercent)

	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("application not found, not assigned to you, or AI percent already set"))
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	response := AIPercentResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
