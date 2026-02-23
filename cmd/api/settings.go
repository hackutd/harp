package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type UpdateShortAnswerQuestionsPayload struct {
	Questions []store.ShortAnswerQuestion `json:"questions" validate:"required,dive"`
}

type ShortAnswerQuestionsResponse struct {
	Questions []store.ShortAnswerQuestion `json:"questions"`
}

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

	response := ShortAnswerQuestionsResponse(req)

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

//	@Summary		Get reviews per application (Super Admin)
//	@Description	Returns the number of reviews required per application
//	@Tags			superadmin
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

//	@Summary		Set reviews per application (Super Admin)
//	@Description	Sets the number of reviews required per application
//	@Tags			superadmin
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
