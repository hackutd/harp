package main

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type SponsorPayload struct {
	Name         string `json:"name" validate:"required,min=1,max=100"`
	Tier         string `json:"tier" validate:"required,min=1,max=50"`
	WebsiteURL   string `json:"website_url" validate:"omitempty,url"`
	LogoPath     string `json:"logo_path"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"display_order" validate:"min=0"`
}

type SponsorResponse struct {
	store.Sponsor
	LogoURL string `json:"logo_url,omitempty"`
}

type SponsorListResponse struct {
	Sponsors []SponsorResponse `json:"sponsors"`
}

type LogoUploadURLResponse struct {
	UploadURL string `json:"upload_url"`
	LogoPath  string `json:"logo_path"`
}

// listSponsorsHandler returns all sponsors (Super Admin)
//
//	@Summary		List sponsors (Super Admin)
//	@Description	Returns all sponsors ordered by display order
//	@Tags			superadmin/sponsors
//	@Produce		json
//	@Success		200	{object}	SponsorListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/sponsors [get]
func (app *application) listSponsorsHandler(w http.ResponseWriter, r *http.Request) {
	sponsors, err := app.store.Sponsors.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := make([]SponsorResponse, len(sponsors))
	for i, s := range sponsors {
		response[i] = SponsorResponse{Sponsor: s}
		if s.LogoPath != "" && app.gcsClient != nil {
			response[i].LogoURL = app.gcsClient.GeneratePublicURL(s.LogoPath)
		}
	}

	if err := app.jsonResponse(w, http.StatusOK, SponsorListResponse{Sponsors: response}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createSponsorHandler creates a new sponsor (Super Admin)
//
//	@Summary		Create sponsor (Super Admin)
//	@Description	Creates a new sponsor
//	@Tags			superadmin/sponsors
//	@Accept			json
//	@Produce		json
//	@Param			sponsor	body		SponsorPayload	true	"Sponsor to create"
//	@Success		201		{object}	SponsorResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/sponsors [post]
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
		LogoPath:     payload.LogoPath,
		WebsiteURL:   payload.WebsiteURL,
		Description:  payload.Description,
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.Sponsors.Create(r.Context(), sponsor); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	resp := SponsorResponse{Sponsor: *sponsor}
	if sponsor.LogoPath != "" && app.gcsClient != nil {
		resp.LogoURL = app.gcsClient.GeneratePublicURL(sponsor.LogoPath)
	}

	if err := app.jsonResponse(w, http.StatusCreated, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateSponsorHandler updates an existing sponsor (Super Admin)
//
//	@Summary		Update sponsor (Super Admin)
//	@Description	Updates an existing sponsor
//	@Tags			superadmin/sponsors
//	@Accept			json
//	@Produce		json
//	@Param			sponsorID	path		string			true	"Sponsor ID"
//	@Param			sponsor		body		SponsorPayload	true	"Sponsor updates"
//	@Success		200			{object}	SponsorResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/sponsors/{sponsorID} [put]
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
		LogoPath:     payload.LogoPath,
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

	// Re-fetch to get created_at if needed, but we have everything else.
	// We can construct response directly or fetch fresh.
	// Since update returns updated_at, we might need to fetch if we want consistent CreatedAt.
	// Let's just return what we have, usually UI updates local state.
	// But to get the correct LogoURL and timestamps, let's fetch.
	updatedSponsor, err := app.store.Sponsors.GetByID(r.Context(), id)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	resp := SponsorResponse{Sponsor: *updatedSponsor}
	if updatedSponsor.LogoPath != "" && app.gcsClient != nil {
		resp.LogoURL = app.gcsClient.GeneratePublicURL(updatedSponsor.LogoPath)
	}

	if err := app.jsonResponse(w, http.StatusOK, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteSponsorHandler deletes a sponsor (Super Admin)
//
//	@Summary		Delete sponsor (Super Admin)
//	@Description	Deletes a sponsor and their logo from GCS
//	@Tags			superadmin/sponsors
//	@Param			sponsorID	path	string	true	"Sponsor ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/sponsors/{sponsorID} [delete]
func (app *application) deleteSponsorHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "sponsorID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing sponsor ID"))
		return
	}

	sponsor, err := app.store.Sponsors.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("sponsor not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.store.Sponsors.Delete(r.Context(), id); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if sponsor.LogoPath != "" && app.gcsClient != nil {
		if err := app.gcsClient.DeleteObject(r.Context(), sponsor.LogoPath); err != nil {
			app.logger.Warnw("failed to delete sponsor logo", "error", err, "path", sponsor.LogoPath)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// generateLogoUploadURLHandler returns a signed upload URL for a sponsor logo (Super Admin)
//
//	@Summary		Generate logo upload URL (Super Admin)
//	@Description	Generates a signed GCS upload URL for a sponsor logo.
//	@Tags			superadmin/sponsors
//	@Produce		json
//	@Param			sponsorID	path		string	true	"Sponsor ID"
//	@Success		200			{object}	LogoUploadURLResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/sponsors/{sponsorID}/logo-upload-url [post]
func (app *application) generateLogoUploadURLHandler(w http.ResponseWriter, r *http.Request) {
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

	if app.gcsClient == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "gcs not configured")
		return
	}

	randomID, err := randomHex(16)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	objectPath := fmt.Sprintf("sponsors/%s/%s", id, randomID)

	uploadURL, err := app.gcsClient.GenerateImageUploadURL(r.Context(), objectPath)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, LogoUploadURLResponse{
		UploadURL: uploadURL,
		LogoPath:  objectPath,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}
