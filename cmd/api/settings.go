package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

// UpdateShortAnswerQuestionsPayload for updating short answer questions
type UpdateShortAnswerQuestionsPayload struct {
	Questions []store.ShortAnswerQuestion `json:"questions" validate:"required,dive"`
}

// ShortAnswerQuestionsResponse wraps short answer questions for API response
type ShortAnswerQuestionsResponse struct {
	Questions []store.ShortAnswerQuestion `json:"questions"`
}

// getShortAnswerQuestions returns all short answer questions
//
//	@Summary		Get short answer questions (Super Admin)
//	@Description	Returns all configurable short answer questions for hacker applications
//	@Tags			superadmin
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
//	@Tags			superadmin
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

	response := ShortAnswerQuestionsResponse{
		Questions: req.Questions,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

func (app *application) setReviewsPerApp(w http.ResponseWriter, r *http.Request) {

}