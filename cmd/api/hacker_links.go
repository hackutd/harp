package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
)

type HackerLinkPayload struct {
	Label        string `json:"label" validate:"required,min=1,max=100"`
	URL          string `json:"url" validate:"required,url,max=2000"`
	Icon         string `json:"icon" validate:"required,oneof=devpost discord github instagram globe link"`
	DisplayOrder int    `json:"display_order" validate:"min=0"`
}

type HackerLinkListResponse struct {
	HackerLinks []store.HackerLink `json:"hacker_links"`
}

// getHackerLinksHandler returns all hacker links for any authenticated user.
//
//	@Summary		Get hacker links
//	@Description	Returns all configured hacker links, ordered by display order
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	HackerLinkListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/hacker-links [get]
func (app *application) getHackerLinksHandler(w http.ResponseWriter, r *http.Request) {
	app.listHackerLinksHandler(w, r)
}

// listHackerLinksHandler returns all hacker links (Super Admin)
//
//	@Summary		List hacker links (Super Admin)
//	@Description	Returns all hacker links ordered by display order
//	@Tags			superadmin/hacker-links
//	@Produce		json
//	@Success		200	{object}	HackerLinkListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/hacker-links [get]
func (app *application) listHackerLinksHandler(w http.ResponseWriter, r *http.Request) {
	links, err := app.store.HackerLinks.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, HackerLinkListResponse{HackerLinks: links}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createHackerLinkHandler creates a new hacker link (Super Admin)
//
//	@Summary		Create hacker link (Super Admin)
//	@Description	Creates a new hacker link shown on the hacker dashboard
//	@Tags			superadmin/hacker-links
//	@Accept			json
//	@Produce		json
//	@Param			link	body		HackerLinkPayload	true	"Hacker link to create"
//	@Success		201		{object}	store.HackerLink
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/hacker-links [post]
func (app *application) createHackerLinkHandler(w http.ResponseWriter, r *http.Request) {
	var payload HackerLinkPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	link := &store.HackerLink{
		Label:        payload.Label,
		URL:          payload.URL,
		Icon:         payload.Icon,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.HackerLinks.Create(r.Context(), link); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, link); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateHackerLinkHandler updates an existing hacker link (Super Admin)
//
//	@Summary		Update hacker link (Super Admin)
//	@Description	Updates an existing hacker link
//	@Tags			superadmin/hacker-links
//	@Accept			json
//	@Produce		json
//	@Param			linkID	path		string				true	"Hacker link ID"
//	@Param			link	body		HackerLinkPayload	true	"Hacker link updates"
//	@Success		200		{object}	store.HackerLink
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/hacker-links/{linkID} [put]
func (app *application) updateHackerLinkHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "linkID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing hacker link ID"))
		return
	}

	var payload HackerLinkPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	link := &store.HackerLink{
		ID:           id,
		Label:        payload.Label,
		URL:          payload.URL,
		Icon:         payload.Icon,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.HackerLinks.Update(r.Context(), link); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("hacker link not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, link); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteHackerLinkHandler deletes a hacker link (Super Admin)
//
//	@Summary		Delete hacker link (Super Admin)
//	@Description	Deletes a hacker link
//	@Tags			superadmin/hacker-links
//	@Param			linkID	path	string	true	"Hacker link ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/hacker-links/{linkID} [delete]
func (app *application) deleteHackerLinkHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "linkID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing hacker link ID"))
		return
	}

	if err := app.store.HackerLinks.Delete(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("hacker link not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
