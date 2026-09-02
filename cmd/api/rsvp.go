package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
)

// RSVPResponse is the hacker-facing view of their RSVP state plus the
// configurable form schema needed to render the RSVP form.
type RSVPResponse struct {
	RSVPStatus      store.RSVPStatus               `json:"rsvp_status"`
	RSVPResponses   json.RawMessage                `json:"rsvp_responses" swaggertype:"object"`
	RSVPSubmittedAt *time.Time                     `json:"rsvp_submitted_at"`
	RSVPSchema      []store.ApplicationSchemaField `json:"rsvp_schema"`
	RSVPEnabled     bool                           `json:"rsvp_enabled"`
}

type SubmitRSVPPayload struct {
	Status    store.RSVPStatus `json:"status" validate:"required,oneof=confirmed declined"`
	Responses json.RawMessage  `json:"responses" swaggertype:"object"`
}

// getMyRSVPHandler returns the authenticated user's RSVP state and form schema
//
//	@Summary		Get RSVP
//	@Description	Returns the authenticated user's RSVP state along with the configurable RSVP form schema and whether RSVPs are currently open. Application must be accepted.
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	RSVPResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}	"Application not accepted"
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me/rsvp [get]
func (app *application) getMyRSVPHandler(w http.ResponseWriter, r *http.Request) {
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

	if application.Status != store.StatusAccepted {
		app.forbiddenResponse(w, r, errors.New("application is not accepted"))
		return
	}

	schema, err := app.store.Settings.GetRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	enabled, err := app.store.Settings.GetRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPResponse{
		RSVPStatus:      application.RSVPStatus,
		RSVPResponses:   application.RSVPResponses,
		RSVPSubmittedAt: application.RSVPSubmittedAt,
		RSVPSchema:      schema,
		RSVPEnabled:     enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// submitMyRSVPHandler submits the authenticated user's one-shot RSVP decision
//
//	@Summary		Submit RSVP
//	@Description	Submits the authenticated user's RSVP decision (confirm or decline). Confirming requires all required RSVP schema fields to be filled. Application must be accepted and RSVP must still be pending. This is a one-shot action.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			rsvp	body		SubmitRSVPPayload	true	"RSVP decision and form responses"
//	@Success		200		{object}	RSVPResponse
//	@Failure		400		{object}	object{error=string}	"Missing required fields"
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}	"Application not accepted or RSVPs closed"
//	@Failure		404		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}	"RSVP already submitted"
//	@Security		CookieAuth
//	@Router			/applications/me/rsvp [post]
func (app *application) submitMyRSVPHandler(w http.ResponseWriter, r *http.Request) {
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

	if application.Status != store.StatusAccepted {
		app.forbiddenResponse(w, r, errors.New("application is not accepted"))
		return
	}

	if application.RSVPStatus != store.RSVPPending {
		app.conflictResponse(w, r, errors.New("rsvp already submitted"))
		return
	}

	var req SubmitRSVPPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	schema, err := app.store.Settings.GetRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Declining a spot never requires form answers; confirming must satisfy
	// the configured RSVP schema.
	rsvpResponses := json.RawMessage(`{}`)
	if req.Status == store.RSVPConfirmed {
		responses := make(map[string]interface{})
		if req.Responses != nil {
			if err := json.Unmarshal(req.Responses, &responses); err != nil {
				app.badRequestResponse(w, r, errors.New("responses must be a JSON object"))
				return
			}
		}

		if validationErrors := validateResponses(schema, responses, true); len(validationErrors) > 0 {
			app.badRequestResponse(w, r, fmt.Errorf("validation errors: %v", validationErrors))
			return
		}

		if req.Responses != nil {
			rsvpResponses = req.Responses
		}
	}

	application.RSVPStatus = req.Status
	application.RSVPResponses = rsvpResponses

	if err := app.store.Application.SubmitRSVP(r.Context(), application); err != nil {
		if errors.Is(err, store.ErrConflict) {
			app.conflictResponse(w, r, errors.New("rsvp already submitted"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	enabled, err := app.store.Settings.GetRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := RSVPResponse{
		RSVPStatus:      application.RSVPStatus,
		RSVPResponses:   application.RSVPResponses,
		RSVPSubmittedAt: application.RSVPSubmittedAt,
		RSVPSchema:      schema,
		RSVPEnabled:     enabled,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// resetApplicationRSVPHandler clears a hacker's one-shot RSVP so they can decide again
//
//	@Summary		Reset RSVP (Super Admin)
//	@Description	Clears a hacker's submitted RSVP so they can claim or decline their spot again. The travel RSVP is cleared along with it — it is only reachable through a confirmed RSVP — and any uploaded travel receipts are removed from object storage.
//	@Tags			superadmin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ApplicationResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/rsvp/reset [post]
func (app *application) resetApplicationRSVPHandler(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	application, receiptPaths, err := app.store.Application.ResetRSVP(r.Context(), applicationID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.logRSVPReset(r, "rsvp", application, receiptPaths)
	app.deleteTravelReceiptObjects(receiptPaths)

	if err := app.jsonResponse(w, http.StatusOK, ApplicationResponse{Application: application}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// logRSVPReset records who reset which RSVP, since the reset discards the
// hacker's submitted answers and there is no other trail of it.
func (app *application) logRSVPReset(r *http.Request, kind string, application *store.Application, receiptPaths []string) {
	var actorID string
	if actor := getUserFromContext(r.Context()); actor != nil {
		actorID = actor.ID
	}

	app.logger.Infow("rsvp reset by super admin",
		"kind", kind,
		"actor_id", actorID,
		"application_id", application.ID,
		"user_id", application.UserID,
		"receipts_detached", len(receiptPaths),
	)
}
