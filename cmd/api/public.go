package main

import (
	"net/http"
)

// getPublicScheduleHandler returns the full schedule (public, API key auth)
//
//	@Summary		Get schedule (Public)
//	@Description	Returns the full event schedule, ordered by start time ascending
//	@Tags			public
//	@Produce		json
//	@Param			X-API-Key	header		string	true	"API Key"
//	@Success		200			{object}	ScheduleListResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Router			/public/schedule [get]
func (app *application) getPublicScheduleHandler(w http.ResponseWriter, r *http.Request) {
	app.listScheduleHandler(w, r)
}
