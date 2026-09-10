package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/harp/internal/store"
)

type ReopenApplicationsPayload struct {
	Statuses []store.ApplicationStatus `json:"statuses" validate:"required,min=1,dive,oneof=submitted accepted rejected waitlisted"`
}

type ReopenApplicationsResponse struct {
	Statuses []store.ApplicationStatus `json:"statuses"`
	Updated  int64                     `json:"updated"`
}

// reopenApplicationsHandler moves all applications with given statuses back to draft
//
//	@Summary		Reopen applications by status (Super Admin)
//	@Description	Sets all applications with the specified statuses back to draft so hackers can re-edit and resubmit. Clears submitted_at on affected rows.
//	@Tags			superadmin/applications
//	@Accept			json
//	@Produce		json
//	@Param			statuses	body		ReopenApplicationsPayload	true	"Source statuses to reopen"
//	@Success		200			{object}	ReopenApplicationsResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/reopen [post]
func (app *application) reopenApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	var req ReopenApplicationsPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	for _, s := range req.Statuses {
		if s == store.StatusDraft {
			app.badRequestResponse(w, r, errors.New("cannot reopen applications that are already in draft"))
			return
		}
	}

	updated, err := app.store.Application.ReopenByStatus(r.Context(), req.Statuses)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ReopenApplicationsResponse{
		Statuses: req.Statuses,
		Updated:  updated,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}
