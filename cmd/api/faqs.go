package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type FAQPayload struct {
	Question     string `json:"question" validate:"required,min=1,max=500"`
	Answer       string `json:"answer" validate:"required,min=1"`
	DisplayOrder int    `json:"display_order" validate:"min=0"`
}

type FAQListResponse struct {
	FAQs []store.FAQ `json:"faqs"`
}

type FAQEditPermissionResponse struct {
	Enabled bool `json:"enabled"`
}

// getFAQEditPermissionHandler returns whether the current user may edit FAQs (Admin)
//
//	@Summary		Get FAQ edit permission (Admin)
//	@Description	Returns whether the current user may create, update, or delete FAQs. Super admins are always allowed; admins depend on the admin FAQ edit setting.
//	@Tags			admin/faq
//	@Produce		json
//	@Success		200	{object}	FAQEditPermissionResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/faq/edit-permission [get]
func (app *application) getFAQEditPermissionHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	enabled := true
	if user.Role != store.RoleSuperAdmin {
		var err error
		enabled, err = app.store.Settings.GetAdminFAQEditEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
	}

	if err := app.jsonResponse(w, http.StatusOK, FAQEditPermissionResponse{Enabled: enabled}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getHackerFAQHandler returns all FAQs for any authenticated user.
//
//	@Summary		Get FAQs
//	@Description	Returns all frequently asked questions, ordered by display order
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	FAQListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/faq [get]
func (app *application) getHackerFAQHandler(w http.ResponseWriter, r *http.Request) {
	app.listFAQsHandler(w, r)
}

// listFAQsHandler returns all FAQs (Admin)
//
//	@Summary		List FAQs (Admin)
//	@Description	Returns all frequently asked questions ordered by display order
//	@Tags			admin/faq
//	@Produce		json
//	@Success		200	{object}	FAQListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/faq [get]
func (app *application) listFAQsHandler(w http.ResponseWriter, r *http.Request) {
	faqs, err := app.store.FAQs.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, FAQListResponse{FAQs: faqs}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createFAQHandler creates a new FAQ (Admin)
//
//	@Summary		Create FAQ (Admin)
//	@Description	Creates a new frequently asked question
//	@Tags			admin/faq
//	@Accept			json
//	@Produce		json
//	@Param			faq	body		FAQPayload	true	"FAQ to create"
//	@Success		201	{object}	store.FAQ
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/faq [post]
func (app *application) createFAQHandler(w http.ResponseWriter, r *http.Request) {
	var payload FAQPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	faq := &store.FAQ{
		Question:     payload.Question,
		Answer:       payload.Answer,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.FAQs.Create(r.Context(), faq); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, faq); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateFAQHandler updates an existing FAQ (Admin)
//
//	@Summary		Update FAQ (Admin)
//	@Description	Updates an existing frequently asked question
//	@Tags			admin/faq
//	@Accept			json
//	@Produce		json
//	@Param			faqID	path		string		true	"FAQ ID"
//	@Param			faq		body		FAQPayload	true	"FAQ updates"
//	@Success		200		{object}	store.FAQ
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/faq/{faqID} [put]
func (app *application) updateFAQHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "faqID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing FAQ ID"))
		return
	}

	var payload FAQPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	faq := &store.FAQ{
		ID:           id,
		Question:     payload.Question,
		Answer:       payload.Answer,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.FAQs.Update(r.Context(), faq); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("FAQ not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, faq); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteFAQHandler deletes a FAQ (Admin)
//
//	@Summary		Delete FAQ (Admin)
//	@Description	Deletes a frequently asked question
//	@Tags			admin/faq
//	@Param			faqID	path	string	true	"FAQ ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/faq/{faqID} [delete]
func (app *application) deleteFAQHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "faqID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing FAQ ID"))
		return
	}

	if err := app.store.FAQs.Delete(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("FAQ not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
