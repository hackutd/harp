package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type UpdateApplicationPayload struct {
	FirstName *string `json:"first_name" validate:"omitempty,min=1"`
	LastName  *string `json:"last_name" validate:"omitempty,min=1"`
	PhoneE164 *string `json:"phone_e164" validate:"omitempty,e164"`
	Age       *int16  `json:"age" validate:"omitempty,min=1,max=150"`

	CountryOfResidence *string `json:"country_of_residence" validate:"omitempty,min=1"`
	Gender             *string `json:"gender" validate:"omitempty,min=1"`
	Race               *string `json:"race" validate:"omitempty,min=1"`
	Ethnicity          *string `json:"ethnicity" validate:"omitempty,min=1"`

	University   *string `json:"university" validate:"omitempty,min=1"`
	Major        *string `json:"major" validate:"omitempty,min=1"`
	LevelOfStudy *string `json:"level_of_study" validate:"omitempty,min=1"`

	ShortAnswerResponses json.RawMessage `json:"short_answer_responses"`

	HackathonsAttendedCount *int16  `json:"hackathons_attended_count" validate:"omitempty,min=0"`
	SoftwareExperienceLevel *string `json:"software_experience_level" validate:"omitempty,min=1"`
	HeardAbout              *string `json:"heard_about" validate:"omitempty,min=1"`

	ShirtSize           *string   `json:"shirt_size" validate:"omitempty,min=1"`
	DietaryRestrictions *[]string `json:"dietary_restrictions"`
	Accommodations      *string   `json:"accommodations"`

	// Social/Professional Links (all optional)
	Github   *string `json:"github" validate:"omitempty,url"`
	LinkedIn *string `json:"linkedin" validate:"omitempty,url"`
	Website  *string `json:"website" validate:"omitempty,url"`

	AckApplication *bool `json:"ack_application"`
	AckMLHCOC      *bool `json:"ack_mlh_coc"`
	AckMLHPrivacy  *bool `json:"ack_mlh_privacy"`
	OptInMLHEmails *bool `json:"opt_in_mlh_emails"`
}

// ApplicationWithQuestions embeds questions in the response for the hacker
type ApplicationWithQuestions struct {
	*store.Application
	ShortAnswerQuestions []store.ShortAnswerQuestion `json:"short_answer_questions"`
}

// getOrCreateApplicationHandler returns the user's application, creating a draft if none exists
//
//	@Summary		Get or create application
//	@Description	Returns the authenticated user's hackathon application. If no application exists, creates a new draft application.
//	@Tags			applications
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	store.Application
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

	// Fetch questions to embed in response
	questions, err := app.store.Settings.GetShortAnswerQuestions(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Return application with embedded questions
	response := ApplicationWithQuestions{
		Application:          application,
		ShortAnswerQuestions: questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateApplicationHandler updates the user's draft application
//
//	@Summary		Update application
//	@Description	Partially updates the authenticated user's application. Only fields included in the request body are updated. Application must be in draft status.
//	@Tags			applications
//	@Accept			json
//	@Produce		json
//	@Param			application	body		UpdateApplicationPayload	true	"Fields to update"
//	@Success		200			{object}	store.Application
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

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// only update if pointer is not nil
	if req.FirstName != nil {
		application.FirstName = req.FirstName
	}
	if req.LastName != nil {
		application.LastName = req.LastName
	}
	if req.PhoneE164 != nil {
		application.PhoneE164 = req.PhoneE164
	}
	if req.Age != nil {
		application.Age = req.Age
	}
	if req.CountryOfResidence != nil {
		application.CountryOfResidence = req.CountryOfResidence
	}
	if req.Gender != nil {
		application.Gender = req.Gender
	}
	if req.Race != nil {
		application.Race = req.Race
	}
	if req.Ethnicity != nil {
		application.Ethnicity = req.Ethnicity
	}
	if req.University != nil {
		application.University = req.University
	}
	if req.Major != nil {
		application.Major = req.Major
	}
	if req.LevelOfStudy != nil {
		application.LevelOfStudy = req.LevelOfStudy
	}
	if req.ShortAnswerResponses != nil {
		application.ShortAnswerResponses = req.ShortAnswerResponses
	}
	if req.HackathonsAttendedCount != nil {
		application.HackathonsAttendedCount = req.HackathonsAttendedCount
	}
	if req.SoftwareExperienceLevel != nil {
		application.SoftwareExperienceLevel = req.SoftwareExperienceLevel
	}
	if req.HeardAbout != nil {
		application.HeardAbout = req.HeardAbout
	}
	if req.ShirtSize != nil {
		application.ShirtSize = req.ShirtSize
	}
	if req.DietaryRestrictions != nil {
		application.DietaryRestrictions = *req.DietaryRestrictions
	}
	if req.Accommodations != nil {
		application.Accommodations = req.Accommodations
	}
	if req.Github != nil {
		application.Github = req.Github
	}
	if req.LinkedIn != nil {
		application.LinkedIn = req.LinkedIn
	}
	if req.Website != nil {
		application.Website = req.Website
	}
	if req.AckApplication != nil {
		application.AckApplication = *req.AckApplication
	}
	if req.AckMLHCOC != nil {
		application.AckMLHCOC = *req.AckMLHCOC
	}
	if req.AckMLHPrivacy != nil {
		application.AckMLHPrivacy = *req.AckMLHPrivacy
	}
	if req.OptInMLHEmails != nil {
		application.OptInMLHEmails = *req.OptInMLHEmails
	}

	if err := app.store.Application.Update(r.Context(), application); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}

// submitApplicationHandler submits the user's draft application
//
//	@Summary		Submit application
//	@Description	Submits the authenticated user's application for review. All required fields must be filled and acknowledgments must be accepted. Application must be in draft status.
//	@Tags			applications
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

	// Validate required fields
	var missing []string

	if application.FirstName == nil {
		missing = append(missing, "first_name")
	}
	if application.LastName == nil {
		missing = append(missing, "last_name")
	}
	if application.PhoneE164 == nil {
		missing = append(missing, "phone_e164")
	}
	if application.Age == nil {
		missing = append(missing, "age")
	}
	if application.CountryOfResidence == nil {
		missing = append(missing, "country_of_residence")
	}
	if application.Gender == nil {
		missing = append(missing, "gender")
	}
	if application.Race == nil {
		missing = append(missing, "race")
	}
	if application.Ethnicity == nil {
		missing = append(missing, "ethnicity")
	}
	if application.University == nil {
		missing = append(missing, "university")
	}
	if application.Major == nil {
		missing = append(missing, "major")
	}
	if application.LevelOfStudy == nil {
		missing = append(missing, "level_of_study")
	}

	// Validate dynamic short answer questions
	questions, err := app.store.Settings.GetShortAnswerQuestions(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	var responses map[string]string
	if application.ShortAnswerResponses != nil {
		if err := json.Unmarshal(application.ShortAnswerResponses, &responses); err != nil {
			responses = make(map[string]string)
		}
	} else {
		responses = make(map[string]string)
	}

	for _, q := range questions {
		if q.Required {
			answer, exists := responses[q.ID]
			if !exists || strings.TrimSpace(answer) == "" {
				missing = append(missing, "short_answer:"+q.ID)
			}
		}
	}

	if application.HackathonsAttendedCount == nil {
		missing = append(missing, "hackathons_attended_count")
	}
	if application.SoftwareExperienceLevel == nil {
		missing = append(missing, "software_experience_level")
	}
	if application.HeardAbout == nil {
		missing = append(missing, "heard_about")
	}
	if application.ShirtSize == nil {
		missing = append(missing, "shirt_size")
	}

	// Validate acknowledgments
	if !application.AckApplication {
		missing = append(missing, "ack_application")
	}
	if !application.AckMLHCOC {
		missing = append(missing, "ack_mlh_coc")
	}
	if !application.AckMLHPrivacy {
		missing = append(missing, "ack_mlh_privacy")
	}

	if len(missing) > 0 {
		app.badRequestResponse(w, r, fmt.Errorf("missing required fields: %v", missing))
		return
	}

	// Submit!
	if err := app.store.Application.Submit(r.Context(), application); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplicationStatsHandler returns aggregated application statistics
//
//	@Summary		Get application stats (Admin)
//	@Description	Returns aggregated statistics for all applications
//	@Tags			admin
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

// listApplicationsHandler lists applications with cursor pagination for admins
//
//	@Summary		List applications (Admin)
//	@Description	Lists all applications with cursor-based pagination and optional status filter
//	@Tags			admin
//	@Produce		json
//	@Param			cursor		query		string	false	"Pagination cursor"
//	@Param			status		query		string	false	"Filter by status (draft, submitted, accepted, rejected, waitlisted)"
//	@Param			limit		query		int		false	"Page size (default 50, max 100)"
//	@Param			direction	query		string	false	"Pagination direction: forward (default) or backward"
//	@Success		200			{object}	store.ApplicationListResult
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
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

	result, err := app.store.Application.List(r.Context(), filters, cursor, direction, limit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, result); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getApplication returns a single application by ID for admin review
//
//	@Summary		Get application by ID (Admin)
//	@Description	Returns a single application by its ID with embedded short answer questions
//	@Tags			admin
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ApplicationWithQuestions
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

	// Fetch questions to embed in response
	questions, err := app.store.Settings.GetShortAnswerQuestions(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Return application with embedded questions
	response := ApplicationWithQuestions{
		Application:          application,
		ShortAnswerQuestions: questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}