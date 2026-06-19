package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

var allowedLogoContentTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
	"image/gif":  true,
}

const maxLogoBytes = 1 * 1024 * 1024 // 1MB decoded limit

type SponsorPayload struct {
	Name         string `json:"name" validate:"required,min=1,max=100"`
	Tier         string `json:"tier" validate:"required,min=1,max=50"`
	WebsiteURL   string `json:"website_url" validate:"omitempty,url"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"display_order" validate:"min=0"`
}

type SponsorListResponse struct {
	Sponsors []store.Sponsor `json:"sponsors"`
}

type LogoUploadPayload struct {
	LogoData    string `json:"logo_data" validate:"required"`
	ContentType string `json:"content_type" validate:"required"`
}

// listSponsorsHandler returns all sponsors (Super Admin)
//
//	@Summary		List sponsors (Super Admin)
//	@Description	Returns all sponsors ordered by display order
//	@Tags			admin/sponsors
//	@Produce		json
//	@Success		200	{object}	SponsorListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/sponsors [get]
func (app *application) listSponsorsHandler(w http.ResponseWriter, r *http.Request) {
	sponsors, err := app.store.Sponsors.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, SponsorListResponse{Sponsors: sponsors}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createSponsorHandler creates a new sponsor (Super Admin)
//
//	@Summary		Create sponsor (Super Admin)
//	@Description	Creates a new sponsor
//	@Tags			admin/sponsors
//	@Accept			json
//	@Produce		json
//	@Param			sponsor	body		SponsorPayload	true	"Sponsor to create"
//	@Success		201		{object}	store.Sponsor
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/sponsors [post]
func (app *application) createSponsorHandler(w http.ResponseWriter, r *http.Request) {
	var payload SponsorPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	sponsor := &store.Sponsor{
		Name:         payload.Name,
		Tier:         payload.Tier,
		WebsiteURL:   payload.WebsiteURL,
		Description:  payload.Description,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.Sponsors.Create(r.Context(), sponsor); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, sponsor); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateSponsorHandler updates an existing sponsor (Super Admin)
//
//	@Summary		Update sponsor (Super Admin)
//	@Description	Updates an existing sponsor
//	@Tags			admin/sponsors
//	@Accept			json
//	@Produce		json
//	@Param			sponsorID	path		string			true	"Sponsor ID"
//	@Param			sponsor		body		SponsorPayload	true	"Sponsor updates"
//	@Success		200			{object}	store.Sponsor
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/sponsors/{sponsorID} [put]
func (app *application) updateSponsorHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sponsorID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing sponsor ID"))
		return
	}

	var payload SponsorPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	sponsor := &store.Sponsor{
		ID:           id,
		Name:         payload.Name,
		Tier:         payload.Tier,
		WebsiteURL:   payload.WebsiteURL,
		Description:  payload.Description,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.Sponsors.Update(r.Context(), sponsor); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("sponsor not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, sponsor); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteSponsorHandler deletes a sponsor (Super Admin)
//
//	@Summary		Delete sponsor (Super Admin)
//	@Description	Deletes a sponsor
//	@Tags			admin/sponsors
//	@Param			sponsorID	path	string	true	"Sponsor ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/sponsors/{sponsorID} [delete]
func (app *application) deleteSponsorHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sponsorID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing sponsor ID"))
		return
	}

	if err := app.store.Sponsors.Delete(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("sponsor not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// uploadLogoHandler uploads a base64-encoded logo for a sponsor (Super Admin)
//
//	@Summary		Upload sponsor logo (Super Admin)
//	@Description	Uploads a base64-encoded logo image for a sponsor
//	@Tags			admin/sponsors
//	@Accept			json
//	@Produce		json
//	@Param			sponsorID	path		string				true	"Sponsor ID"
//	@Param			body		body		LogoUploadPayload	true	"Base64-encoded logo"
//	@Success		200			{object}	store.Sponsor
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/sponsors/{sponsorID}/logo [put]
func (app *application) uploadLogoHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sponsorID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing sponsor ID"))
		return
	}

	if _, err := app.store.Sponsors.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("sponsor not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	var payload LogoUploadPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if !allowedLogoContentTypes[payload.ContentType] {
		app.badRequestResponse(w, r, fmt.Errorf("unsupported content type: %s", payload.ContentType))
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(payload.LogoData)
	if err != nil {
		app.badRequestResponse(w, r, errors.New("invalid base64 data"))
		return
	}

	if len(decoded) > maxLogoBytes {
		app.badRequestResponse(w, r, fmt.Errorf("logo exceeds maximum size of %d bytes", maxLogoBytes))
		return
	}

	if err := app.store.Sponsors.UpdateLogo(r.Context(), id, payload.LogoData, payload.ContentType); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("sponsor not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	sponsor, err := app.store.Sponsors.GetByID(r.Context(), id)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, sponsor); err != nil {
		app.internalServerError(w, r, err)
	}
}
