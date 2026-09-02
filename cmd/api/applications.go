package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
)

type UpdateApplicationPayload struct {
	Responses  json.RawMessage `json:"responses" swaggertype:"object"`
	ResumePath *string         `json:"resume_path"`
}

// ApplicationWithSchema embeds the schema in the response for the hacker
type ApplicationWithSchema struct {
	*store.Application
	ApplicationSchema []store.ApplicationSchemaField `json:"application_schema"`
	// Points is the user's total scan points; populated on read endpoints only.
	Points int `json:"points"`
}

// userPoints returns the user's total scan points. Points are cosmetic, so a
// lookup failure is logged and reported as 0 rather than failing the request.
func (app *application) userPoints(r *http.Request, userID string) int {
	points, err := app.store.Scans.GetTotalPointsByUserID(r.Context(), userID)
	if err != nil {
		app.logger.Warnw("failed to fetch scan points", "user_id", userID, "error", err)
		return 0
	}

	return points
}

// getOrCreateApplicationHandler returns or creates the user's hackathon application
//
//	@Summary		Get or create application
//	@Description	Returns the authenticated user's hackathon application. If no application exists, creates a new draft application.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	ApplicationWithSchema
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me [get]
func (app *application) getOrCreateApplicationHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Create new draft application (app not found)
			application = &store.Application{UserID: user.ID}
			if err := app.store.Application.Create(r.Context(), application); err != nil {
				if errors.Is(err, store.ErrConflict) {
					// Race condition: another request created the application -> fetch it
					application, err = app.store.Application.GetByUserID(r.Context(), user.ID)
					if err != nil {
						app.internalServerError(w, r, err)
						return
					}
				} else {
					app.internalServerError(w, r, err)
					return
				}
			}
		} else {
			app.internalServerError(w, r, err)
			return
		}
	}

	// Fetch schema to embed in response
	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationWithSchema{
		Application:       application,
		ApplicationSchema: schema,
		Points:            app.userPoints(r, user.ID),
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateApplicationHandler partially updates the authenticated user's application
//
//	@Summary		Update application
//	@Description	Partially updates the authenticated user's application. Only fields included in the request body are updated. Application must be in draft status.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			application	body		UpdateApplicationPayload	true	"Fields to update"
//	@Success		200			{object}	ApplicationWithSchema
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}	"Application not in draft status"
//	@Security		CookieAuth
//	@Router			/applications/me [patch]
func (app *application) updateApplicationHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if application.Status != store.StatusDraft {
		app.conflictResponse(w, r, errors.New("cannot update submitted application"))
		return
	}

	var req UpdateApplicationPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Only update if field is present in the request
	if req.Responses != nil {
		// Validate types against the schema before persisting. Required fields are
		// not enforced here so incomplete drafts can still be saved, but wrong types
		// (e.g. a non-numeric age) are rejected to keep downstream queries safe.
		var responses map[string]interface{}
		if err := json.Unmarshal(req.Responses, &responses); err != nil {
			app.badRequestResponse(w, r, errors.New("responses must be a JSON object"))
			return
		}

		if validationErrors := validateResponses(schema, responses, false); len(validationErrors) > 0 {
			app.badRequestResponse(w, r, fmt.Errorf("validation errors: %v", validationErrors))
			return
		}

		application.Responses = req.Responses
	}
	if req.ResumePath != nil {
		if !validResumeObjectPath(*req.ResumePath, user.ID) {
			app.badRequestResponse(w, r, errors.New("invalid resume path"))
			return
		}
		application.ResumePath = req.ResumePath
	}

	if err := app.store.Application.Update(r.Context(), application); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationWithSchema{
		Application:       application,
		ApplicationSchema: schema,
		Points:            app.userPoints(r, user.ID),
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// submitApplicationHandler submits the authenticated user's application for review
//
//	@Summary		Submit application
//	@Description	Submits the authenticated user's application for review. All required schema fields must be filled and acknowledgments must be accepted. Application must be in draft status.
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	store.Application
//	@Failure		400	{object}	object{error=string}	"Missing required fields"
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		409	{object}	object{error=string}	"Application not in draft status"
//	@Security		CookieAuth
//	@Router			/applications/me/submit [post]
func (app *application) submitApplicationHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if application.Status != store.StatusDraft {
		app.conflictResponse(w, r, errors.New("application already submitted"))
		return
	}

	// Fetch the application schema for validation
	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Parse responses for validation
	var responses map[string]interface{}
	if application.Responses != nil {
		if err := json.Unmarshal(application.Responses, &responses); err != nil {
			responses = make(map[string]interface{})
		}
	} else {
		responses = make(map[string]interface{})
	}

	// Validate responses against schema
	validationErrors := validateResponses(schema, responses, true)

	if len(validationErrors) > 0 {
		app.badRequestResponse(w, r, fmt.Errorf("validation errors: %v", validationErrors))
		return
	}

	// Submit! The travel opt-in binding is resolved against the live schema, so
	// an event that removed the checkbox simply requests no travel.
	optInFieldID := schemaContractFieldID(schema, travelOptInFieldID)
	if err := app.store.Application.Submit(r.Context(), application, optInFieldID); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}

// validateResponses checks each response value against its schema field definition.
// Returns a list of human-readable validation error strings. When enforceRequired
// is false, missing/empty required fields are allowed (used for draft saves) while
// type checks on present values still apply.
func validateResponses(schema []store.ApplicationSchemaField, responses map[string]interface{}, enforceRequired bool) []string {
	var errs []string

	for _, field := range schema {
		val, exists := responses[field.ID]

		// A field with validation.required_if is required only when its
		// controller condition holds (e.g. travel questions are required only
		// when travel_reimbursement is checked, or flight fields only when
		// travel_rsvp_mode is "Flying").
		required := field.Required
		if !required {
			if requiredIf, ok := field.Validation["required_if"].(string); ok && requiredIf != "" {
				if conditionSatisfied(requiredIf, responses) {
					required = true
				}
			}
		}

		// Required check
		if enforceRequired && required && (!exists || isEmpty(val)) {
			errs = append(errs, field.ID+" is required")
			continue
		}

		// Skip further validation if value is absent or empty
		if !exists || isEmpty(val) {
			continue
		}

		// Type-specific validation
		switch field.Type {
		case "text", "textarea", "phone":
			s, ok := val.(string)
			if !ok {
				errs = append(errs, field.ID+" must be a string")
				continue
			}
			if maxLen, ok := field.Validation["maxLength"]; ok {
				if ml, ok := maxLen.(float64); ok && float64(len(s)) > ml {
					errs = append(errs, fmt.Sprintf("%s exceeds max length of %d", field.ID, int(ml)))
				}
			}

		case "number":
			n, ok := val.(float64)
			if !ok {
				errs = append(errs, field.ID+" must be a number")
				continue
			}
			if minVal, ok := field.Validation["min"]; ok {
				if mv, ok := minVal.(float64); ok && n < mv {
					errs = append(errs, fmt.Sprintf("%s must be at least %v", field.ID, mv))
				}
			}
			if maxVal, ok := field.Validation["max"]; ok {
				if mv, ok := maxVal.(float64); ok && n > mv {
					errs = append(errs, fmt.Sprintf("%s must be at most %v", field.ID, mv))
				}
			}

		case "select":
			s, ok := val.(string)
			if !ok {
				errs = append(errs, field.ID+" must be a string")
				continue
			}
			if len(field.Options) > 0 && !containsString(field.Options, s) {
				errs = append(errs, field.ID+" has invalid option: "+s)
			}

		case "multi_select":
			arr, ok := val.([]interface{})
			if !ok {
				errs = append(errs, field.ID+" must be an array")
				continue
			}
			for _, item := range arr {
				s, ok := item.(string)
				if !ok {
					errs = append(errs, field.ID+" array items must be strings")
					break
				}
				if len(field.Options) > 0 && !containsString(field.Options, s) {
					errs = append(errs, field.ID+" has invalid option: "+s)
				}
			}

		case "checkbox":
			b, ok := val.(bool)
			if !ok {
				errs = append(errs, field.ID+" must be a boolean")
			} else if enforceRequired && field.Required && !b {
				errs = append(errs, field.ID+" must be checked")
			}
		}
	}

	return errs
}

// conditionSatisfied evaluates a conditional-field controller expression from
// validation.show_if / required_if. The expression is either a checkbox field
// id ("field", satisfied when the response is true) or a select equality
// ("field=Value", satisfied when the response equals the value).
func conditionSatisfied(expr string, responses map[string]interface{}) bool {
	if fieldID, want, found := strings.Cut(expr, "="); found {
		got, _ := responses[fieldID].(string)
		return got == want
	}
	controller, ok := responses[expr].(bool)
	return ok && controller
}

// isEmpty checks if a response value is considered empty
func isEmpty(val interface{}) bool {
	if val == nil {
		return true
	}
	switch v := val.(type) {
	case string:
		return strings.TrimSpace(v) == ""
	case []interface{}:
		return len(v) == 0
	default:
		return false
	}
}

// containsString checks if a string slice contains the given value
func containsString(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

// getApplicationStatsHandler returns aggregated statistics for all applications
//
//	@Summary		Get application stats (Admin)
//	@Description	Returns aggregated statistics for all applications
//	@Tags			admin/applications
//	@Produce		json
//	@Success		200	{object}	store.ApplicationStats
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/stats [get]
func (app *application) getApplicationStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := app.store.Application.GetStats(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, stats); err != nil {
		app.internalServerError(w, r, err)
	}
}

// listApplicationsHandler lists all applications with cursor-based pagination
//
//	@Summary		List applications (Admin)
//	@Description	Lists all applications with cursor-based pagination and optional status filter
//	@Tags			admin/applications
//	@Produce		json
//	@Param			cursor				query		string	false	"Pagination cursor"
//	@Param			status				query		string	false	"Filter by status (draft, submitted, accepted, rejected, waitlisted)"
//	@Param			travel_status		query		string	false	"Filter by travel status (not_requested, pending, approved, rejected)"
//	@Param			rsvp_status			query		string	false	"Filter by RSVP status (pending, confirmed, declined)"
//	@Param			travel_rsvp_status	query		string	false	"Filter by travel form status (pending, confirmed, declined)"
//	@Param			has_receipts		query		boolean	false	"Filter by whether at least one receipt was submitted"
//	@Param			travel_requested	query		boolean	false	"Filter by whether travel reimbursement was requested"
//	@Param			limit				query		int		false	"Page size (default 50, max 100)"
//	@Param			direction			query		string	false	"Pagination direction: forward (default) or backward"
//	@Param			sort_by				query		string	false	"Sort column: created_at (default), accept_votes, reject_votes, waitlist_votes, travel_yes_votes"
//	@Success		200					{object}	store.ApplicationListResult
//	@Failure		400					{object}	object{error=string}
//	@Failure		401					{object}	object{error=string}
//	@Failure		403					{object}	object{error=string}
//	@Failure		500					{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications [get]
func (app *application) listApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Parse cursor
	var cursor *store.ApplicationCursor
	if cursorStr := query.Get("cursor"); cursorStr != "" {
		var err error
		cursor, err = store.DecodeCursor(cursorStr)
		if err != nil {
			app.badRequestResponse(w, r, errors.New("invalid cursor"))
			return
		}
	}

	// Parse status filter
	var filters store.ApplicationListFilters
	if statusStr := query.Get("status"); statusStr != "" {
		status := store.ApplicationStatus(statusStr)
		switch status {
		case store.StatusDraft, store.StatusSubmitted, store.StatusAccepted,
			store.StatusRejected, store.StatusWaitlisted:
			filters.Status = &status
		default:
			app.badRequestResponse(w, r, errors.New("invalid status value"))
			return
		}
	}

	// Parse travel status filter
	if travelStr := query.Get("travel_status"); travelStr != "" {
		travelStatus := store.TravelStatus(travelStr)
		switch travelStatus {
		case store.TravelNotRequested, store.TravelPending,
			store.TravelApproved, store.TravelRejected:
			filters.TravelStatus = &travelStatus
		default:
			app.badRequestResponse(w, r, errors.New("invalid travel_status value"))
			return
		}
	}

	parseRSVPStatus := func(value string) (*store.RSVPStatus, bool) {
		status := store.RSVPStatus(value)
		switch status {
		case store.RSVPPending, store.RSVPConfirmed, store.RSVPDeclined:
			return &status, true
		default:
			return nil, false
		}
	}
	if value := query.Get("rsvp_status"); value != "" {
		status, ok := parseRSVPStatus(value)
		if !ok {
			app.badRequestResponse(w, r, errors.New("invalid rsvp_status value"))
			return
		}
		filters.RSVPStatus = status
	}
	if value := query.Get("travel_rsvp_status"); value != "" {
		status, ok := parseRSVPStatus(value)
		if !ok {
			app.badRequestResponse(w, r, errors.New("invalid travel_rsvp_status value"))
			return
		}
		filters.TravelRSVPStatus = status
	}
	if value := query.Get("has_receipts"); value != "" {
		hasReceipts, err := strconv.ParseBool(value)
		if err != nil {
			app.badRequestResponse(w, r, errors.New("has_receipts must be true or false"))
			return
		}
		filters.HasReceipts = &hasReceipts
	}
	if value := query.Get("travel_requested"); value != "" {
		travelRequested, err := strconv.ParseBool(value)
		if err != nil {
			app.badRequestResponse(w, r, errors.New("travel_requested must be true or false"))
			return
		}
		filters.TravelRequested = &travelRequested
	}

	// Parse search
	if searchStr := query.Get("search"); searchStr != "" {
		if len(searchStr) < 2 {
			app.badRequestResponse(w, r, errors.New("search must be at least 2 characters"))
			return
		}
		if len(searchStr) > 100 {
			app.badRequestResponse(w, r, errors.New("search must be at most 100 characters"))
			return
		}
		filters.Search = &searchStr
	}

	// Parse limit
	limit := 50
	if limitStr := query.Get("limit"); limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 || parsedLimit > 100 {
			app.badRequestResponse(w, r, errors.New("limit must be between 1 and 100"))
			return
		}
		limit = parsedLimit
	}

	// Parse direction
	direction := store.DirectionForward
	if dirStr := query.Get("direction"); dirStr != "" {
		switch store.PaginationDirection(dirStr) {
		case store.DirectionForward, store.DirectionBackward:
			direction = store.PaginationDirection(dirStr)
		default:
			app.badRequestResponse(w, r, errors.New("direction must be 'forward' or 'backward'"))
			return
		}
	}

	// Parse sort_by
	if sortStr := query.Get("sort_by"); sortStr != "" {
		switch store.ApplicationSortBy(sortStr) {
		case store.SortByCreatedAt, store.SortByAcceptVotes,
			store.SortByRejectVotes, store.SortByWaitlistVotes,
			store.SortByTravelYesVotes:
			filters.SortBy = store.ApplicationSortBy(sortStr)
		default:
			app.badRequestResponse(w, r, errors.New("invalid sort_by value"))
			return
		}
	}

	result, err := app.store.Application.List(r.Context(), filters, cursor, direction, limit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, result); err != nil {
		app.internalServerError(w, r, err)
	}
}

type SetStatusPayload struct {
	Status store.ApplicationStatus `json:"status" validate:"required,oneof=accepted rejected waitlisted"`
}

type SetTravelStatusPayload struct {
	TravelStatus        store.TravelStatus `json:"travel_status" validate:"required,oneof=pending approved rejected"`
	ApprovedAmountCents *int64             `json:"approved_amount_cents,omitempty" validate:"omitempty,gt=0"`
}

type ApplicationResponse struct {
	Application *store.Application `json:"application"`
}

type ApplicantInfo struct {
	Email     string  `json:"email"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
}

type EmailListResponse struct {
	Applicants []ApplicantInfo `json:"applicants"`
	Count      int             `json:"count"`
}

// setApplicationStatus sets the final status on an application
//
//	@Summary		Set application status (Super Admin)
//	@Description	Sets the final status (accepted, rejected, or waitlisted) on an application
//	@Tags			superadmin/applications
//	@Accept			json
//	@Produce		json
//	@Param			applicationID	path		string				true	"Application ID"
//	@Param			status			body		SetStatusPayload	true	"New status"
//	@Success		200				{object}	ApplicationResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/status [patch]
func (app *application) setApplicationStatus(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	var payload SetStatusPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	application, err := app.store.Application.SetStatus(r.Context(), applicationID, payload.Status)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ApplicationResponse{Application: application}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setApplicationTravelStatus sets the travel reimbursement decision on an application
//
//	@Summary		Set travel reimbursement status (Super Admin)
//	@Description	Sets the travel reimbursement decision (approved, rejected, or back to pending) on an application that requested travel reimbursement. The application must be submitted, accepted, or waitlisted, and the decision is pinned once the hacker submits their travel RSVP — reset the travel RSVP first to change it.
//	@Tags			superadmin/applications
//	@Accept			json
//	@Produce		json
//	@Param			applicationID	path		string					true	"Application ID"
//	@Param			travel_status	body		SetTravelStatusPayload	true	"New travel status"
//	@Success		200				{object}	ApplicationResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		409				{object}	object{error=string}	"Travel not requested, application not decidable, or travel RSVP already submitted"
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/travel-status [patch]
func (app *application) setApplicationTravelStatus(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	var payload SetTravelStatusPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if payload.TravelStatus == store.TravelApproved && payload.ApprovedAmountCents == nil {
		app.badRequestResponse(w, r, errors.New("approved_amount_cents is required when approving travel"))
		return
	}
	if payload.TravelStatus != store.TravelApproved && payload.ApprovedAmountCents != nil {
		app.badRequestResponse(w, r, errors.New("approved_amount_cents is only allowed when approving travel"))
		return
	}

	application, err := app.store.Application.SetTravelStatus(r.Context(), applicationID, payload.TravelStatus, payload.ApprovedAmountCents)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("application not found"))
		case errors.Is(err, store.ErrTravelNotRequested):
			app.conflictResponse(w, r, errors.New("applicant did not request travel reimbursement"))
		case errors.Is(err, store.ErrTravelStatusNotDecidable):
			app.conflictResponse(w, r, errors.New("travel cannot be decided on a draft or rejected application"))
		case errors.Is(err, store.ErrTravelRSVPSubmitted):
			app.conflictResponse(w, r, errors.New("hacker already submitted their travel form; reset it before changing the travel decision"))
		case errors.Is(err, store.ErrConflict):
			app.conflictResponse(w, r, errors.New("travel status changed concurrently, try again"))
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ApplicationResponse{Application: application}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplication returns a single application by ID with embedded schema
//
//	@Summary		Get application by ID (Admin)
//	@Description	Returns a single application by its ID with embedded application schema
//	@Tags			admin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ApplicationWithSchema
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/{applicationID} [get]
func (app *application) getApplication(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	application, err := app.store.Application.GetByID(r.Context(), applicationID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	// Fetch schema to embed in response
	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := ApplicationWithSchema{
		Application:       application,
		ApplicationSchema: schema,
		Points:            app.userPoints(r, application.UserID),
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicantEmailsByStatusHandler returns applicant emails filtered by status
//
//	@Summary		Get applicant emails by status (Super Admin)
//	@Description	Returns a list of applicant emails filtered by application status (accepted, rejected, or waitlisted)
//	@Tags			superadmin/applications
//	@Produce		json
//	@Param			status	query		string	true	"Application status (accepted, rejected, or waitlisted)"
//	@Success		200		{object}	EmailListResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/emails [get]
func (app *application) getApplicantEmailsByStatusHandler(w http.ResponseWriter, r *http.Request) {
	statusStr := r.URL.Query().Get("status")
	if statusStr == "" {
		app.badRequestResponse(w, r, errors.New("status is required"))
		return
	}

	status := store.ApplicationStatus(statusStr)
	switch status {
	case store.StatusAccepted, store.StatusRejected, store.StatusWaitlisted:
	default:
		app.badRequestResponse(w, r, errors.New("status must be one of accepted, rejected, or waitlisted"))
		return
	}

	users, err := app.store.Application.GetEmailsByStatus(r.Context(), status)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	applicants := make([]ApplicantInfo, len(users))
	for i, u := range users {
		applicants[i] = ApplicantInfo{
			Email:     u.Email,
			FirstName: u.FirstName,
			LastName:  u.LastName,
		}
	}

	response := EmailListResponse{
		Applicants: applicants,
		Count:      len(applicants),
	}

	if err = app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
