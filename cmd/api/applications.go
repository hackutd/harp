package main

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type UpdateApplicationPayload struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	PhoneE164 *string `json:"phone_e164"`
	Age       *int16  `json:"age"`

	CountryOfResidence *string `json:"country_of_residence"`
	Gender             *string `json:"gender"`
	Race               *string `json:"race"`
	Ethnicity          *string `json:"ethnicity"`

	University   *string `json:"university"`
	Major        *string `json:"major"`
	LevelOfStudy *string `json:"level_of_study"`

	WhyAttend           *string `json:"why_attend"`
	HackathonsLearned   *string `json:"hackathons_learned"`
	FirstHackathonGoals *string `json:"first_hackathon_goals"`
	LookingForward      *string `json:"looking_forward"`

	HackathonsAttendedCount *int16  `json:"hackathons_attended_count"`
	SoftwareExperienceLevel *string `json:"software_experience_level"`
	HeardAbout              *string `json:"heard_about"`

	ShirtSize           *string   `json:"shirt_size"`
	DietaryRestrictions *[]string `json:"dietary_restrictions"`
	Accommodations      *string   `json:"accommodations"`

	// Social/Professional Links (all optional)
	Github   *string `json:"github"`
	LinkedIn *string `json:"linkedin"`
	Website  *string `json:"website"`

	AckApplication *bool `json:"ack_application"`
	AckMLHCOC      *bool `json:"ack_mlh_coc"`
	AckMLHPrivacy  *bool `json:"ack_mlh_privacy"`
	OptInMLHEmails *bool `json:"opt_in_mlh_emails"`
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

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
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
	if req.WhyAttend != nil {
		application.WhyAttend = req.WhyAttend
	}
	if req.HackathonsLearned != nil {
		application.HackathonsLearned = req.HackathonsLearned
	}
	if req.FirstHackathonGoals != nil {
		application.FirstHackathonGoals = req.FirstHackathonGoals
	}
	if req.LookingForward != nil {
		application.LookingForward = req.LookingForward
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
	if application.WhyAttend == nil {
		missing = append(missing, "why_attend")
	}
	if application.HackathonsLearned == nil {
		missing = append(missing, "hackathons_learned")
	}
	if application.FirstHackathonGoals == nil {
		missing = append(missing, "first_hackathon_goals")
	}
	if application.LookingForward == nil {
		missing = append(missing, "looking_forward")
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

	// Submit the application
	if err := app.store.Application.Submit(r.Context(), application); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}
