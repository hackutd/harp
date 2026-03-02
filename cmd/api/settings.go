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

// getShortAnswerQuestions returns all configurable short answer questions
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

type SetReviewsPerAppPayload struct {
	ReviewsPerApplication int `json:"reviews_per_application" validate:"required,min=1,max=10"`
}

type ReviewsPerAppResponse struct {
	ReviewsPerApplication int `json:"reviews_per_application"`
}

// getReviewsPerApp returns the number of reviews required per application
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

// setReviewsPerApp sets the number of reviews required per application
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

// SetReviewAssignmentTogglePayload for setting whether review assignment is enabled
type SetReviewAssignmentTogglePayload struct {
	UserID  string `json:"user_id" validate:"required"`
	Enabled bool   `json:"enabled"`
}

// ReviewAssignmentToggleResponse wraps the review assignment enabled value for API response
type ReviewAssignmentToggleResponse struct {
	Enabled bool `json:"enabled"`
}

type ReviewAssignmentAdmin struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Enabled bool   `json:"enabled"`
}

type ReviewAssignmentListResponse struct {
	Admins []ReviewAssignmentAdmin `json:"admins"`
}

// getReviewAssignmentToggle returns the current review assignment enabled setting
//
//	@Summary		Get review assignment settings (Super Admin)
//	@Description	Returns list of super admins and their review assignment toggle status
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	ReviewAssignmentListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/review-assignment-toggle [get]
func (app *application) getReviewAssignmentToggle(w http.ResponseWriter, r *http.Request) {
	admins, err := app.store.Users.GetByRole(r.Context(), store.RoleSuperAdmin)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	toggles, err := app.store.Settings.GetAllReviewAssignmentToggles(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	toggleMap := make(map[string]bool)
	for _, t := range toggles {
		toggleMap[t.ID] = t.Enabled
	}

	result := make([]ReviewAssignmentAdmin, 0, len(admins))
	for _, admin := range admins {
		enabled, exists := toggleMap[admin.ID]
		if !exists {
			enabled = true // Default to true
		}
		result = append(result, ReviewAssignmentAdmin{
			ID:      admin.ID,
			Email:   admin.Email,
			Enabled: enabled,
		})
	}

	if err := app.jsonResponse(w, http.StatusOK, ReviewAssignmentListResponse{Admins: result}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setReviewAssignmentToggle updates the review assignment enabled setting
//
//	@Summary		Set review assignment enabled state for a user (Super Admin)
//	@Description	Updates whether automatic review assignment is enabled for a specific super admin
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetReviewAssignmentTogglePayload	true	"Review assignment enabled state"
//	@Success		200		{object}	ReviewAssignmentToggleResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/review-assignment-toggle [post]
func (app *application) setReviewAssignmentToggle(w http.ResponseWriter, r *http.Request) {
	var req SetReviewAssignmentTogglePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetReviewAssignmentToggle(r.Context(), req.UserID, req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewAssignmentToggleResponse{Enabled: req.Enabled}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
