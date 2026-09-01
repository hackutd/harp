package main

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/hackutd/harp/internal/store"
)

type UpdateApplicationSchemaPayload struct {
	Fields []store.ApplicationSchemaField `json:"fields" validate:"required,dive"`
}

type ApplicationSchemaResponse struct {
	Fields []store.ApplicationSchemaField `json:"fields"`
	// Warnings names well-known bindings the saved schema no longer declares,
	// so the editor can say which feature just went inactive.
	Warnings []string `json:"warnings,omitempty"`
}

// getApplicationSchema returns the configurable application schema
//
//	@Summary		Get application schema (Super Admin)
//	@Description	Returns the configurable application schema fields for hacker applications
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	ApplicationSchemaResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/application-schema [get]
func (app *application) getApplicationSchema(w http.ResponseWriter, r *http.Request) {
	fields, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationSchemaResponse{
		Fields: fields,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateApplicationSchema replaces the application schema
//
//	@Summary		Update application schema (Super Admin)
//	@Description	Replaces the application schema with the provided array of fields. Rejected when a well-known field the backend reads (see /superadmin/settings/schema-contract) is still present but no longer usable; removing such a field is allowed and comes back as a warning.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			fields	body		UpdateApplicationSchemaPayload	true	"Schema fields to set"
//	@Success		200		{object}	ApplicationSchemaResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/application-schema [put]
func (app *application) updateApplicationSchema(w http.ResponseWriter, r *http.Request) {
	var req UpdateApplicationSchemaPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	warnings, err := validateSchemaFields(applicationSchemaContracts, req.Fields)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.UpdateApplicationSchema(r.Context(), req.Fields); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationSchemaResponse{Fields: req.Fields, Warnings: warnings}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type UpdateRSVPSchemaPayload struct {
	Fields []store.ApplicationSchemaField `json:"fields" validate:"required,dive"`
}

type RSVPSchemaResponse struct {
	Fields []store.ApplicationSchemaField `json:"fields"`
}

// getRSVPSchema returns the configurable RSVP schema
//
//	@Summary		Get RSVP schema (Super Admin)
//	@Description	Returns the configurable RSVP form schema fields for accepted hackers
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	RSVPSchemaResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/rsvp-schema [get]
func (app *application) getRSVPSchema(w http.ResponseWriter, r *http.Request) {
	fields, err := app.store.Settings.GetRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPSchemaResponse{
		Fields: fields,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateRSVPSchema replaces the RSVP schema
//
//	@Summary		Update RSVP schema (Super Admin)
//	@Description	Replaces the RSVP form schema with the provided array of fields
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			fields	body		UpdateRSVPSchemaPayload	true	"Schema fields to set"
//	@Success		200		{object}	RSVPSchemaResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/rsvp-schema [put]
func (app *application) updateRSVPSchema(w http.ResponseWriter, r *http.Request) {
	var req UpdateRSVPSchemaPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if _, err := validateSchemaFields(nil, req.Fields); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.UpdateRSVPSchema(r.Context(), req.Fields); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPSchemaResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type SetRSVPEnabledPayload struct {
	Enabled bool `json:"enabled"`
}

type RSVPEnabledResponse struct {
	Enabled bool `json:"enabled"`
}

// getRSVPEnabled returns whether RSVPs are currently open
//
//	@Summary		Get RSVP enabled status (Super Admin)
//	@Description	Returns whether accepted hackers can currently submit an RSVP
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	RSVPEnabledResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/rsvp-enabled [get]
func (app *application) getRSVPEnabled(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPEnabledResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setRSVPEnabled updates whether RSVPs are currently open
//
//	@Summary		Set RSVP enabled status (Super Admin)
//	@Description	Sets whether accepted hackers can currently submit an RSVP. Requires SuperAdmin privileges.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		SetRSVPEnabledPayload	true	"Enable or disable RSVPs"
//	@Success		200		{object}	RSVPEnabledResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/rsvp-enabled [put]
func (app *application) setRSVPEnabled(w http.ResponseWriter, r *http.Request) {
	var req SetRSVPEnabledPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetRSVPEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPEnabledResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type UpdateTravelRSVPSchemaPayload struct {
	Fields []store.ApplicationSchemaField `json:"fields" validate:"required,dive"`
}

type TravelRSVPSchemaResponse struct {
	Fields []store.ApplicationSchemaField `json:"fields"`
	// Warnings names well-known bindings the saved schema no longer declares,
	// so the editor can say which feature just went inactive.
	Warnings []string `json:"warnings,omitempty"`
}

// getTravelRSVPSchema returns the configurable travel RSVP schema
//
//	@Summary		Get travel RSVP schema (Super Admin)
//	@Description	Returns the configurable travel RSVP form schema fields for hackers with approved travel reimbursement
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	TravelRSVPSchemaResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/travel-rsvp-schema [get]
func (app *application) getTravelRSVPSchema(w http.ResponseWriter, r *http.Request) {
	fields, err := app.store.Settings.GetTravelRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPSchemaResponse{
		Fields: fields,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateTravelRSVPSchema replaces the travel RSVP schema
//
//	@Summary		Update travel RSVP schema (Super Admin)
//	@Description	Replaces the travel RSVP form schema with the provided array of fields. Rejected when a well-known field the backend reads (see /superadmin/settings/schema-contract) is still present but no longer usable; removing such a field is allowed and comes back as a warning.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			fields	body		UpdateTravelRSVPSchemaPayload	true	"Schema fields to set"
//	@Success		200		{object}	TravelRSVPSchemaResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/travel-rsvp-schema [put]
func (app *application) updateTravelRSVPSchema(w http.ResponseWriter, r *http.Request) {
	var req UpdateTravelRSVPSchemaPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	warnings, err := validateSchemaFields(travelRSVPSchemaContracts, req.Fields)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.UpdateTravelRSVPSchema(r.Context(), req.Fields); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPSchemaResponse{Fields: req.Fields, Warnings: warnings}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type SetTravelRSVPEnabledPayload struct {
	Enabled bool `json:"enabled"`
}

type TravelRSVPEnabledResponse struct {
	Enabled bool `json:"enabled"`
}

// getTravelRSVPEnabled returns whether travel RSVPs are currently open
//
//	@Summary		Get travel RSVP enabled status (Super Admin)
//	@Description	Returns whether hackers with approved travel can currently submit their travel RSVP
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	TravelRSVPEnabledResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/travel-rsvp-enabled [get]
func (app *application) getTravelRSVPEnabled(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetTravelRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPEnabledResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setTravelRSVPEnabled updates whether travel RSVPs are currently open
//
//	@Summary		Set travel RSVP enabled status (Super Admin)
//	@Description	Sets whether hackers with approved travel can currently submit their travel RSVP. Requires SuperAdmin privileges.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		SetTravelRSVPEnabledPayload	true	"Enable or disable travel RSVPs"
//	@Success		200		{object}	TravelRSVPEnabledResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/travel-rsvp-enabled [put]
func (app *application) setTravelRSVPEnabled(w http.ResponseWriter, r *http.Request) {
	var req SetTravelRSVPEnabledPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetTravelRSVPEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPEnabledResponse(req)

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

type SetAdminScheduleEditTogglePayload struct {
	Enabled bool `json:"enabled"`
}

type AdminScheduleEditToggleResponse struct {
	Enabled bool `json:"enabled"`
}

type SetAdminSponsorEditTogglePayload struct {
	Enabled bool `json:"enabled"`
}

type AdminSponsorEditToggleResponse struct {
	Enabled bool `json:"enabled"`
}

type SetAdminFAQEditTogglePayload struct {
	Enabled bool `json:"enabled"`
}

type AdminFAQEditToggleResponse struct {
	Enabled bool `json:"enabled"`
}

type SetHackathonDateRangePayload struct {
	StartDate string `json:"start_date" validate:"required"`
	EndDate   string `json:"end_date" validate:"required"`
}

type SetApplicationsEnabledPayload struct {
	Enabled bool `json:"enabled"`
}

type ApplicationsEnabledResponse struct {
	Enabled bool `json:"enabled"`
}

type HackathonDateRangeResponse struct {
	StartDate  *string `json:"start_date"`
	EndDate    *string `json:"end_date"`
	Configured bool    `json:"configured"`
}

type SetHackerPackURLPayload struct {
	URL string `json:"url"`
}

type HackerPackURLResponse struct {
	URL string `json:"url"`
}

type SetPointsNamePayload struct {
	Name string `json:"name" validate:"required,min=1,max=30"`
}

type PointsNameResponse struct {
	Name string `json:"name"`
}

type SetPointsEnabledPayload struct {
	Enabled bool `json:"enabled"`
}

type PointsEnabledResponse struct {
	Enabled bool `json:"enabled"`
}

// PointsConfigResponse is the points system state every authenticated user
// needs: what points are called, and whether they are used at all.
type PointsConfigResponse struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

// setReviewAssignmentToggle updates the review assignment enabled setting
//
//	@Summary		Set review assignment enabled state for a user (Super Admin)
//	@Description	Updates whether automatic review assignment is enabled for a specific super admin
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetReviewAssignmentTogglePayload	true	"Review assignment enabled state"
//	@Success		200		{object}	ReviewAssignmentToggleResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/review-assignment-toggle [put]
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

// getAdminSponsorEditToggle returns whether admins can edit sponsors
//
//	@Summary		Get admin sponsor edit state (Super Admin)
//	@Description	Returns whether users with admin role can create, update, and delete sponsors
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	AdminSponsorEditToggleResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-sponsor-edit-toggle [get]
func (app *application) getAdminSponsorEditToggle(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetAdminSponsorEditEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminSponsorEditToggleResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setAdminSponsorEditToggle updates whether admins can edit sponsors
//
//	@Summary		Set admin sponsor edit state (Super Admin)
//	@Description	Updates whether users with admin role can create, update, and delete sponsors
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetAdminSponsorEditTogglePayload	true	"Admin sponsor editing enabled state"
//	@Success		200		{object}	AdminSponsorEditToggleResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-sponsor-edit-toggle [post]
func (app *application) setAdminSponsorEditToggle(w http.ResponseWriter, r *http.Request) {
	var req SetAdminSponsorEditTogglePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetAdminSponsorEditEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminSponsorEditToggleResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getAdminFAQEditToggle returns whether admins can edit FAQs
//
//	@Summary		Get admin FAQ edit state (Super Admin)
//	@Description	Returns whether users with admin role can create, update, and delete FAQs
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	AdminFAQEditToggleResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-faq-edit-toggle [get]
func (app *application) getAdminFAQEditToggle(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetAdminFAQEditEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminFAQEditToggleResponse{
		Enabled: enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setAdminFAQEditToggle updates whether admins can edit FAQs
//
//	@Summary		Set admin FAQ edit state (Super Admin)
//	@Description	Updates whether users with admin role can create, update, and delete FAQs
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetAdminFAQEditTogglePayload	true	"Admin FAQ editing enabled state"
//	@Success		200		{object}	AdminFAQEditToggleResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/admin-faq-edit-toggle [post]
func (app *application) setAdminFAQEditToggle(w http.ResponseWriter, r *http.Request) {
	var req SetAdminFAQEditTogglePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetAdminFAQEditEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := AdminFAQEditToggleResponse(req)

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

// getHackerPackURL returns the configured Hacker Pack Notion URL
//
//	@Summary		Get Hacker Pack URL (Super Admin)
//	@Description	Returns the configured Hacker Pack Notion URL
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	HackerPackURLResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hacker-pack-url [get]
func (app *application) getHackerPackURL(w http.ResponseWriter, r *http.Request) {
	url, err := app.store.Settings.GetHackerPackURL(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackerPackURLResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setHackerPackURL updates the Hacker Pack Notion URL
//
//	@Summary		Set Hacker Pack URL (Super Admin)
//	@Description	Updates the Hacker Pack Notion URL embedded on the hacker-facing Hacker Pack page
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			url	body		SetHackerPackURLPayload	true	"Hacker Pack Notion URL"
//	@Success		200	{object}	HackerPackURLResponse
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hacker-pack-url [post]
func (app *application) setHackerPackURL(w http.ResponseWriter, r *http.Request) {
	var req SetHackerPackURLPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	url := strings.TrimSpace(req.URL)
	lower := strings.ToLower(url)
	if url != "" && !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		app.badRequestResponse(w, r, errors.New("url must start with http:// or https://"))
		return
	}

	if err := app.store.Settings.SetHackerPackURL(r.Context(), url); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackerPackURLResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getHackerPackHandler returns the configured Hacker Pack Notion URL for any authenticated user.
//
//	@Summary		Get Hacker Pack URL
//	@Description	Returns the configured Hacker Pack Notion URL to embed on the hacker dashboard
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	HackerPackURLResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/hacker-pack [get]
func (app *application) getHackerPackHandler(w http.ResponseWriter, r *http.Request) {
	url, err := app.store.Settings.GetHackerPackURL(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackerPackURLResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setPointsName updates the points system display name
//
//	@Summary		Set points system name (Super Admin)
//	@Description	Updates the display name of the points system shown to hackers and admins
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			name	body		SetPointsNamePayload	true	"Points system name"
//	@Success		200		{object}	PointsNameResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/points-name [post]
func (app *application) setPointsName(w http.ResponseWriter, r *http.Request) {
	var req SetPointsNamePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Trim before validating so a whitespace-only name still fails min=1.
	req.Name = strings.TrimSpace(req.Name)
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetPointsName(r.Context(), req.Name); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, PointsNameResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPointsEnabled returns whether the points system is enabled
//
//	@Summary		Get points system enabled state (Super Admin)
//	@Description	Returns whether the points system is enabled
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	PointsEnabledResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/points-enabled [get]
func (app *application) getPointsEnabled(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetPointsEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, PointsEnabledResponse{Enabled: enabled}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setPointsEnabled updates whether the points system is enabled
//
//	@Summary		Set points system enabled state (Super Admin)
//	@Description	Updates whether the points system is enabled. When disabled it is hidden from the hacker portal.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			enabled	body		SetPointsEnabledPayload	true	"Points system enabled state"
//	@Success		200		{object}	PointsEnabledResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/points-enabled [post]
func (app *application) setPointsEnabled(w http.ResponseWriter, r *http.Request) {
	var req SetPointsEnabledPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetPointsEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, PointsEnabledResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPointsConfigHandler returns the points system config for any authenticated user.
//
//	@Summary		Get points system config
//	@Description	Returns the display name of the points system and whether it is enabled
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	PointsConfigResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/points-config [get]
func (app *application) getPointsConfigHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	name, err := app.store.Settings.GetPointsName(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	enabled, err := app.store.Settings.GetPointsEnabled(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := PointsConfigResponse{Name: name, Enabled: enabled}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type UpdateMealGroupsPayload struct {
	Groups []string `json:"groups" validate:"max=50,dive,required,min=1,max=50"`
}

type MealGroupsResponse struct {
	Groups []string `json:"groups"`
}

type MealGroupStatsResponse struct {
	Stats map[string]int `json:"stats"`
}

// getMealGroups returns the configured meal group names
//
//	@Summary		Get meal groups (Super Admin)
//	@Description	Returns the configured list of meal group names
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	MealGroupsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/meal-groups [get]
func (app *application) getMealGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := app.store.Settings.GetMealGroups(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, MealGroupsResponse{Groups: groups}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateMealGroups replaces all meal group names
//
//	@Summary		Update meal groups (Super Admin)
//	@Description	Replaces the available meal group names with the provided array
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			groups	body		UpdateMealGroupsPayload	true	"Groups to set"
//	@Success		200		{object}	MealGroupsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/meal-groups [put]
func (app *application) updateMealGroups(w http.ResponseWriter, r *http.Request) {
	var req UpdateMealGroupsPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	for i := range req.Groups {
		req.Groups[i] = strings.TrimSpace(req.Groups[i])
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Validate unique names
	nameMap := make(map[string]bool)
	for _, name := range req.Groups {
		if nameMap[name] {
			app.badRequestResponse(w, r, errors.New("duplicate meal group name: "+name))
			return
		}
		nameMap[name] = true
	}

	if err := app.store.Settings.SetMealGroups(r.Context(), req.Groups); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, MealGroupsResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getMealGroupStats returns the number of hackers assigned to each meal group
//
//	@Summary		Get meal group stats (Super Admin)
//	@Description	Returns assignment counts for each configured meal group
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	MealGroupStatsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/meal-groups/stats [get]
func (app *application) getMealGroupStats(w http.ResponseWriter, r *http.Request) {
	stats, err := app.store.Settings.GetMealGroupStats(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, MealGroupStatsResponse{Stats: stats}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicationsEnabled returns whether applications are currently open
//
//	@Summary		Get applications enabled status
//	@Description	Returns whether the application portal is currently open for submissions
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	ApplicationsEnabledResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/enabled [get]
func (app *application) getApplicationsEnabled(w http.ResponseWriter, r *http.Request) {
	enabled, err := app.store.Settings.GetApplicationsEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationsEnabledResponse{
		Enabled: enabled,
	}

	if err = app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
		return
	}
}

// setApplicationsEnabled updates whether applications are currently open
//
//	@Summary		Set applications enabled status (Super Admin)
//	@Description	Sets whether the application portal is currently open for submissions. Requires SuperAdmin privileges.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		SetApplicationsEnabledPayload	true	"Enable or disable applications"
//	@Success		200		{object}	ApplicationsEnabledResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/applications-enabled [put]
func (app *application) setApplicationsEnabled(w http.ResponseWriter, r *http.Request) {
	var req SetApplicationsEnabledPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetApplicationsEnabled(r.Context(), req.Enabled); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationsEnabledResponse(req)

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type HackathonNameResponse struct {
	Name string `json:"name"`
}

type SetHackathonNamePayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type EmailSettingResponse struct {
	Email string `json:"email"`
}

type SetEmailSettingPayload struct {
	Email string `json:"email" validate:"required,email"`
}

type FromNameResponse struct {
	Name string `json:"name"`
}

type SetFromNamePayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type DateSettingResponse struct {
	Date       string `json:"date"`
	Configured bool   `json:"configured"`
}

type SetDateSettingPayload struct {
	Date string `json:"date" validate:"required"`
}

// OnboardingStatusResponse reports which required hackathon settings are
// configured. The SuperAdmin onboarding form is shown until complete is true.
type OnboardingStatusResponse struct {
	HackathonName      bool `json:"hackathon_name"`
	HackathonDateRange bool `json:"hackathon_date_range"`
	ApplicationDueDate bool `json:"application_due_date"`
	ContactEmail       bool `json:"contact_email"`
	FromEmail          bool `json:"from_email"`
	Complete           bool `json:"complete"`
}

// HackathonConfigResponse exposes the hackathon identity and key dates to any
// authenticated user so hacker-facing pages don't hardcode them. Kickoff is the
// hackathon start date, so it isn't configured (or returned) separately.
type HackathonConfigResponse struct {
	HackathonName      string  `json:"hackathon_name"`
	ContactEmail       string  `json:"contact_email"`
	ApplicationDueDate string  `json:"application_due_date"`
	StartDate          *string `json:"start_date"`
	EndDate            *string `json:"end_date"`
}

// parseDateOnly validates a YYYY-MM-DD date string.
func parseDateOnly(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if _, err := time.Parse("2006-01-02", trimmed); err != nil {
		return "", errors.New("date must be YYYY-MM-DD")
	}
	return trimmed, nil
}

// getHackathonName returns the configured hackathon name
//
//	@Summary		Get hackathon name (Super Admin)
//	@Description	Returns the configured hackathon name
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	HackathonNameResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hackathon-name [get]
func (app *application) getHackathonName(w http.ResponseWriter, r *http.Request) {
	name, err := app.store.Settings.GetHackathonName(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackathonNameResponse{Name: name}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setHackathonName updates the configured hackathon name
//
//	@Summary		Set hackathon name (Super Admin)
//	@Description	Updates the hackathon name shown across the portal and in emails
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			name	body		SetHackathonNamePayload	true	"Hackathon name"
//	@Success		200		{object}	HackathonNameResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/hackathon-name [post]
func (app *application) setHackathonName(w http.ResponseWriter, r *http.Request) {
	var req SetHackathonNamePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetHackathonName(r.Context(), req.Name); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackathonNameResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getContactEmail returns the configured public contact email
//
//	@Summary		Get contact email (Super Admin)
//	@Description	Returns the configured public contact email
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	EmailSettingResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/contact-email [get]
func (app *application) getContactEmail(w http.ResponseWriter, r *http.Request) {
	email, err := app.store.Settings.GetContactEmail(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, EmailSettingResponse{Email: email}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setContactEmail updates the public contact email
//
//	@Summary		Set contact email (Super Admin)
//	@Description	Updates the public contact email shown to hackers
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			email	body		SetEmailSettingPayload	true	"Contact email"
//	@Success		200		{object}	EmailSettingResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/contact-email [post]
func (app *application) setContactEmail(w http.ResponseWriter, r *http.Request) {
	var req SetEmailSettingPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetContactEmail(r.Context(), req.Email); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, EmailSettingResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getFromEmail returns the configured sender email
//
//	@Summary		Get sender email (Super Admin)
//	@Description	Returns the configured from-address for outgoing email
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	EmailSettingResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/from-email [get]
func (app *application) getFromEmail(w http.ResponseWriter, r *http.Request) {
	email, err := app.store.Settings.GetFromEmail(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, EmailSettingResponse{Email: email}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setFromEmail updates the sender email
//
//	@Summary		Set sender email (Super Admin)
//	@Description	Updates the from-address used for outgoing email
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			email	body		SetEmailSettingPayload	true	"Sender email"
//	@Success		200		{object}	EmailSettingResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/from-email [post]
func (app *application) setFromEmail(w http.ResponseWriter, r *http.Request) {
	var req SetEmailSettingPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetFromEmail(r.Context(), req.Email); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, EmailSettingResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getFromName returns the configured sender display name
//
//	@Summary		Get sender name (Super Admin)
//	@Description	Returns the configured display name for outgoing email
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	FromNameResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/from-name [get]
func (app *application) getFromName(w http.ResponseWriter, r *http.Request) {
	name, err := app.store.Settings.GetFromName(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, FromNameResponse{Name: name}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setFromName updates the sender display name
//
//	@Summary		Set sender name (Super Admin)
//	@Description	Updates the display name used for outgoing email
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			name	body		SetFromNamePayload	true	"Sender display name"
//	@Success		200		{object}	FromNameResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/from-name [post]
func (app *application) setFromName(w http.ResponseWriter, r *http.Request) {
	var req SetFromNamePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetFromName(r.Context(), req.Name); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, FromNameResponse(req)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicationDueDate returns the application deadline
//
//	@Summary		Get application due date (Super Admin)
//	@Description	Returns the configured application deadline
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	DateSettingResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/application-due-date [get]
func (app *application) getApplicationDueDate(w http.ResponseWriter, r *http.Request) {
	date, err := app.store.Settings.GetApplicationDueDate(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DateSettingResponse{Date: date, Configured: date != ""}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setApplicationDueDate updates the application deadline
//
//	@Summary		Set application due date (Super Admin)
//	@Description	Updates the application deadline (YYYY-MM-DD)
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			date	body		SetDateSettingPayload	true	"Application due date"
//	@Success		200		{object}	DateSettingResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/application-due-date [post]
func (app *application) setApplicationDueDate(w http.ResponseWriter, r *http.Request) {
	var req SetDateSettingPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	date, err := parseDateOnly(req.Date)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetApplicationDueDate(r.Context(), date); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DateSettingResponse{Date: date, Configured: true}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getOnboardingStatus reports which required hackathon settings are configured
//
//	@Summary		Get onboarding status (Super Admin)
//	@Description	Returns which required hackathon settings are configured and whether onboarding is complete
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	OnboardingStatusResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/onboarding-status [get]
func (app *application) getOnboardingStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	name, err := app.store.Settings.GetHackathonName(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	dateRange, err := app.store.Settings.GetHackathonDateRange(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	appDue, err := app.store.Settings.GetApplicationDueDate(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	contactEmail, err := app.store.Settings.GetContactEmail(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	fromEmail, err := app.store.Settings.GetFromEmail(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := OnboardingStatusResponse{
		HackathonName:      name != "",
		HackathonDateRange: dateRange.StartDate != nil && dateRange.EndDate != nil,
		ApplicationDueDate: appDue != "",
		ContactEmail:       contactEmail != "",
		FromEmail:          fromEmail != "",
	}
	response.Complete = response.HackathonName &&
		response.HackathonDateRange &&
		response.ApplicationDueDate &&
		response.ContactEmail &&
		response.FromEmail

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getHackathonConfigHandler returns hackathon identity and key dates
//
//	@Summary		Get hackathon config
//	@Description	Returns the configured hackathon name, contact email and key dates for hacker-facing pages
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	HackathonConfigResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/hackathon-config [get]
func (app *application) getHackathonConfigHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	name, err := app.store.Settings.GetHackathonName(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	contactEmail, err := app.store.Settings.GetContactEmail(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	appDue, err := app.store.Settings.GetApplicationDueDate(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	dateRange, err := app.store.Settings.GetHackathonDateRange(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := HackathonConfigResponse{
		HackathonName:      name,
		ContactEmail:       contactEmail,
		ApplicationDueDate: appDue,
		StartDate:          dateRange.StartDate,
		EndDate:            dateRange.EndDate,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

type SetURLSettingPayload struct {
	URL string `json:"url"`
}

type URLSettingResponse struct {
	URL string `json:"url"`
}

// LegalConfigResponse carries the operator's own policy links. It is served
// unauthenticated because the login page asserts agreement to both documents
// before anyone has a session, and a claim we cannot link is worse than no
// claim at all.
type LegalConfigResponse struct {
	PrivacyPolicyURL string `json:"privacy_policy_url"`
	TermsURL         string `json:"terms_url"`
}

// normalizeOptionalURL trims a user-supplied link and rejects anything that is
// not http(s). Empty is valid and means "not configured" — the login page hides
// the link rather than pointing at a document that does not exist.
func normalizeOptionalURL(raw string) (string, error) {
	url := strings.TrimSpace(raw)
	if url == "" {
		return "", nil
	}

	lower := strings.ToLower(url)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return "", errors.New("url must start with http:// or https://")
	}
	return url, nil
}

// getLegalConfigHandler returns the operator's policy links for the login page.
//
//	@Summary		Get legal document links
//	@Description	Returns the configured privacy policy and terms of service URLs. Unauthenticated so the login page can link them before sign-in. Empty values mean the operator has not configured that document.
//	@Tags			public
//	@Produce		json
//	@Success		200	{object}	LegalConfigResponse
//	@Failure		500	{object}	object{error=string}
//	@Router			/legal [get]
func (app *application) getLegalConfigHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	privacyURL, err := app.store.Settings.GetPrivacyPolicyURL(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	termsURL, err := app.store.Settings.GetTermsURL(ctx)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := LegalConfigResponse{
		PrivacyPolicyURL: privacyURL,
		TermsURL:         termsURL,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPrivacyPolicyURL returns the configured privacy policy link
//
//	@Summary		Get privacy policy URL (Super Admin)
//	@Description	Returns the configured privacy policy link
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	URLSettingResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/privacy-policy-url [get]
func (app *application) getPrivacyPolicyURL(w http.ResponseWriter, r *http.Request) {
	url, err := app.store.Settings.GetPrivacyPolicyURL(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, URLSettingResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setPrivacyPolicyURL updates the privacy policy link
//
//	@Summary		Set privacy policy URL (Super Admin)
//	@Description	Updates the privacy policy link shown on the login page. Send an empty string to hide it.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			url	body		SetURLSettingPayload	true	"Privacy policy URL"
//	@Success		200	{object}	URLSettingResponse
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/privacy-policy-url [post]
func (app *application) setPrivacyPolicyURL(w http.ResponseWriter, r *http.Request) {
	var req SetURLSettingPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	url, err := normalizeOptionalURL(req.URL)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetPrivacyPolicyURL(r.Context(), url); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, URLSettingResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getTermsURL returns the configured terms of service link
//
//	@Summary		Get terms of service URL (Super Admin)
//	@Description	Returns the configured terms of service link
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	URLSettingResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/terms-url [get]
func (app *application) getTermsURL(w http.ResponseWriter, r *http.Request) {
	url, err := app.store.Settings.GetTermsURL(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, URLSettingResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setTermsURL updates the terms of service link
//
//	@Summary		Set terms of service URL (Super Admin)
//	@Description	Updates the terms of service link shown on the login page. Send an empty string to hide it.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			url	body		SetURLSettingPayload	true	"Terms of service URL"
//	@Success		200	{object}	URLSettingResponse
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/terms-url [post]
func (app *application) setTermsURL(w http.ResponseWriter, r *http.Request) {
	var req SetURLSettingPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	url, err := normalizeOptionalURL(req.URL)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetTermsURL(r.Context(), url); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, URLSettingResponse{URL: url}); err != nil {
		app.internalServerError(w, r, err)
	}
}
