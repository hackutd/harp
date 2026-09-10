package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/harp/internal/store"
)

type ReopenTravelPayload struct {
	Statuses []store.TravelStatus `json:"statuses" validate:"required,min=1,dive,oneof=approved rejected"`
}

type ReopenTravelResponse struct {
	Statuses []store.TravelStatus `json:"statuses"`
	Updated  int64                `json:"updated"`
}

// reopenTravelApplicationsHandler moves all applications with given travel statuses back to pending
//
//	@Summary		Reopen travel applications by status (Super Admin)
//	@Description	Sets travel status back to pending for all applications with the specified travel statuses.
//	@Tags			superadmin/applications
//	@Accept			json
//	@Produce		json
//	@Param			statuses	body		ReopenTravelPayload	true	"Source travel statuses to reopen"
//	@Success		200			{object}	ReopenTravelResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/travel/reopen [post]
func (app *application) reopenTravelApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	var req ReopenTravelPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	for _, s := range req.Statuses {
		if s == store.TravelPending || s == store.TravelNotRequested {
			app.badRequestResponse(w, r, errors.New("cannot reopen travel applications that are pending or not requested"))
			return
		}
	}

	updated, err := app.store.Application.ReopenTravelByStatus(r.Context(), req.Statuses)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ReopenTravelResponse{
		Statuses: req.Statuses,
		Updated:  updated,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}
