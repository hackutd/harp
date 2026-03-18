package main

import (
	"errors"
	"net/http"
	"time"

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
//	@Tags			superadmin/settings
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
//	@Tags			superadmin/settings
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
//	@Tags			superadmin/settings
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
//	@Tags			superadmin/settings
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
	UserID  string `json:"user_id"`
	Enabled bool   `json:"enabled"`
}

type ReviewAssignmentAdmin struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Enabled bool   `json:"enabled"`
}

type ReviewAssignmentListResponse struct {
	Admins []ReviewAssignmentAdmin `json:"admins"`
}

type SetAdminScheduleEditTogglePayload struct {
	Enabled bool `json:"enabled"`
}

type AdminScheduleEditToggleResponse struct {
	Enabled bool `json:"enabled"`
}

type SetHackathonDateRangePayload struct {
	StartDate string `json:"start_date" validate:"required"`
	EndDate   string `json:"end_date" validate:"required"`
}

type HackathonDateRangeResponse struct {
	StartDate  *string `json:"start_date"`
	EndDate    *string `json:"end_date"`
	Configured bool    `json:"configured"`
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

	// Validate that user_id belongs to an existing super admin
	targetUser, err := app.store.Users.GetByID(r.Context(), req.UserID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("user not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	if targetUser.Role != store.RoleSuperAdmin {
		app.badRequestResponse(w, r, errors.New("user is not a super admin"))
		return
	}

	if err := app.store.Settings.SetReviewAssignmentToggle(r.Context(), req.UserID, req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ReviewAssignmentToggleResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getAdminScheduleEditToggle returns whether admins can edit schedule
//
//	@Summary		Get admin schedule edit state (Super Admin)
//	@Description	Returns whether users with admin role can create, update, and delete schedule items
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	AdminScheduleEditToggleResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-schedule-edit-toggle [get]
func (app *application) getAdminScheduleEditToggle(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetAdminScheduleEditEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminScheduleEditToggleResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setAdminScheduleEditToggle updates whether admins can edit schedule
//
//	@Summary		Set admin schedule edit state (Super Admin)
//	@Description	Updates whether users with admin role can create, update, and delete schedule items
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetAdminScheduleEditTogglePayload	true	"Admin schedule editing enabled state"
//	@Success		200		{object}	AdminScheduleEditToggleResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-schedule-edit-toggle [post]
func (app *application) setAdminScheduleEditToggle(w http.ResponseWriter, r *http.Request) {
	var req SetAdminScheduleEditTogglePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetAdminScheduleEditEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminScheduleEditToggleResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getHackathonDateRange returns hackathon start/end dates
//
//	@Summary		Get hackathon date range (Super Admin)
//	@Description	Returns configured hackathon start and end dates
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	HackathonDateRangeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hackathon-date-range [get]
func (app *application) getHackathonDateRange(w http.ResponseWriter, r *http.Request) {
	dateRange, err := app.store.Settings.GetHackathonDateRange(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := HackathonDateRangeResponse{
		StartDate:  dateRange.StartDate,
		EndDate:    dateRange.EndDate,
		Configured: dateRange.StartDate != nil && dateRange.EndDate != nil,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setHackathonDateRange updates hackathon start/end dates
//
//	@Summary		Set hackathon date range (Super Admin)
//	@Description	Updates configured hackathon start and end dates. Range must be at most 7 days inclusive.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			range	body		SetHackathonDateRangePayload	true	"Hackathon date range"
//	@Success		200		{object}	HackathonDateRangeResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hackathon-date-range [post]
func (app *application) setHackathonDateRange(w http.ResponseWriter, r *http.Request) {
	var req SetHackathonDateRangePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if req.StartDate == "" || req.EndDate == "" {
		app.badRequestResponse(w, r, errors.New("start_date and end_date are required"))
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		app.badRequestResponse(w, r, errors.New("start_date must be YYYY-MM-DD"))
		return
	}

	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		app.badRequestResponse(w, r, errors.New("end_date must be YYYY-MM-DD"))
		return
	}

	if endDate.Before(startDate) {
		app.badRequestResponse(w, r, errors.New("end_date must be on or after start_date"))
		return
	}

	durationDays := int(endDate.Sub(startDate).Hours()/24) + 1
	if durationDays > 7 {
		app.badRequestResponse(w, r, errors.New("hackathon date range cannot exceed 7 days"))
		return
	}

	dateRange := store.HackathonDateRange{
		StartDate: &req.StartDate,
		EndDate:   &req.EndDate,
	}
	if err := app.store.Settings.SetHackathonDateRange(r.Context(), dateRange); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := HackathonDateRangeResponse{
		StartDate:  dateRange.StartDate,
		EndDate:    dateRange.EndDate,
		Configured: true,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
