package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

// UpdateSettingsPayload for updating questions
type UpdateSettingsPayload struct {
	Questions []store.ShortAnswerQuestion `json:"questions" validate:"required,dive"`
}

// SettingsResponse wraps settings for API response
type SettingsResponse struct {
	Questions []store.ShortAnswerQuestion `json:"questions"`
}

// getSettingsHandler returns current settings including short answer questions
//
//	@Summary		Get settings (Super Admin)
//	@Description	Returns all hackathon settings including short answer questions
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	SettingsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings [get]
func (app *application) getSettingsHandler(w http.ResponseWriter, r *http.Request) {
	questions, err := app.store.Settings.GetShortAnswerQuestions(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := SettingsResponse{
		Questions: questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateSettingsHandler replaces short answer questions
//
//	@Summary		Update settings (Super Admin)
//	@Description	Replaces all short answer questions with the provided array
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			settings	body		UpdateSettingsPayload	true	"Questions to set"
//	@Success		200			{object}	SettingsResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings [put]
func (app *application) updateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	var req UpdateSettingsPayload
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

	response := SettingsResponse{
		Questions: req.Questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
