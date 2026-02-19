package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type UpdateShortAnswerQuestionsPayload struct {
	Questions []store.ShortAnswerQuestion `json:"questions" validate:"required,dive"`
}

type ShortAnswerQuestionsResponse struct {
	Questions []store.ShortAnswerQuestion `json:"questions"`
}

// getShortAnswerQuestions returns all short answer questions
//
//	@Summary		Get short answer questions (Super Admin)
//	@Description	Returns all configurable short answer questions for hacker applications
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	ShortAnswerQuestionsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/saquestions [get]
func (app *application) getShortAnswerQuestions(w http.ResponseWriter, r *http.Request) {
	questions, err := app.store.Settings.GetShortAnswerQuestions(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ShortAnswerQuestionsResponse{
		Questions: questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateShortAnswerQuestions replaces all short answer questions
//
//	@Summary		Update short answer questions (Super Admin)
//	@Description	Replaces all short answer questions with the provided array
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			questions	body		UpdateShortAnswerQuestionsPayload	true	"Questions to set"
//	@Success		200			{object}	ShortAnswerQuestionsResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/saquestions [put]
func (app *application) updateShortAnswerQuestions(w http.ResponseWriter, r *http.Request) {
	var req UpdateShortAnswerQuestionsPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Validate unique IDs
	idMap := make(map[string]bool)
	for _, q := range req.Questions {
		if idMap[q.ID] {
			app.badRequestResponse(w, r, errors.New("duplicate question ID: "+q.ID))
			return
		}
		idMap[q.ID] = true
	}

	if err := app.store.Settings.UpdateShortAnswerQuestions(r.Context(), req.Questions); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ShortAnswerQuestionsResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// SetReviewsPerAppPayload for setting the reviews per application count
type SetReviewsPerAppPayload struct {
	ReviewsPerApplication int `json:"reviews_per_application" validate:"required,min=1,max=10"`
}

// ReviewsPerAppResponse wraps the reviews per application value for API response
type ReviewsPerAppResponse struct {
	ReviewsPerApplication int `json:"reviews_per_application"`
}

// getReviewsPerApp returns the current reviews per application setting
//
//	@Summary		Get reviews per application (Super Admin)
//	@Description	Returns the number of reviews required per application
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	ReviewsPerAppResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/reviews-per-app [get]
func (app *application) getReviewsPerApp(w http.ResponseWriter, r *http.Request) {
	count, err := app.store.Settings.GetReviewsPerApplication(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewsPerAppResponse{
		ReviewsPerApplication: count,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setReviewsPerApp updates the reviews per application setting
//
//	@Summary		Set reviews per application (Super Admin)
//	@Description	Sets the number of reviews required per application
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			reviews_per_application	body		SetReviewsPerAppPayload	true	"Reviews per application value"
//	@Success		200						{object}	ReviewsPerAppResponse
//	@Failure		400						{object}	object{error=string}
//	@Failure		401						{object}	object{error=string}
//	@Failure		403						{object}	object{error=string}
//	@Failure		500						{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/reviews-per-app [post]
func (app *application) setReviewsPerApp(w http.ResponseWriter, r *http.Request) {
	var req SetReviewsPerAppPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetReviewsPerApplication(r.Context(), req.ReviewsPerApplication); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewsPerAppResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// SetReviewAssignmentEnabledPayload for setting whether review assignment is enabled
type SetReviewAssignmentEnabledPayload struct {
	Enabled bool `json:"enabled"`
}

// ReviewAssignmentEnabledResponse wraps the review assignment enabled value for API response
type ReviewAssignmentEnabledResponse struct {
	Enabled bool `json:"enabled"`
}

// getReviewAssignmentEnabled returns the current review assignment enabled setting
//
//	@Summary		Get review assignment enabled state (Super Admin)
//	@Description	Returns whether automatic review assignment is enabled
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	ReviewAssignmentEnabledResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/review-assignment-enabled [get]
func (app *application) getReviewAssignmentEnabled(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.internalServerError(w, r, errors.New("user not in context"))
		return
	}

	enabled, err := app.store.Settings.GetReviewAssignmentEnabled(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewAssignmentEnabledResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setReviewAssignmentEnabled updates the review assignment enabled setting
//
//	@Summary		Set review assignment enabled state (Super Admin)
//	@Description	Updates whether automatic review assignment is enabled
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetReviewAssignmentEnabledPayload	true	"Review assignment enabled state"
//	@Success		200		{object}	ReviewAssignmentEnabledResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/review-assignment-enabled [post]
func (app *application) setReviewAssignmentEnabled(w http.ResponseWriter, r *http.Request) {
	var req SetReviewAssignmentEnabledPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	user := getUserFromContext(r.Context())
	if user == nil {
		app.internalServerError(w, r, errors.New("user not in context"))
		return
	}

	if err := app.store.Settings.SetReviewAssignmentEnabled(r.Context(), user.ID, req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewAssignmentEnabledResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
