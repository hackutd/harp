package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
)

// Track logos reuse allowedLogoContentTypes from sponsors.go, but not maxLogoBytes:
// readJSON caps the whole request body at 1MB and base64 inflates the payload by
// ~4/3, so a 1MB decoded ceiling is unreachable. 750KB decoded encodes to ~1000KB,
// which fits inside the body cap and fails with a useful message instead of a
// generic "http: request body too large".
const maxTrackLogoBytes = 750 * 1024

type TrackPrizePayload struct {
	Place string `json:"place" validate:"required,min=1,max=50"`
	Prize string `json:"prize" validate:"required,min=1,max=200"`
}

type TrackPayload struct {
	Title        string              `json:"title" validate:"required,min=1,max=200"`
	SponsorName  string              `json:"sponsor_name" validate:"max=100"`
	Description  string              `json:"description"`
	Prizes       []TrackPrizePayload `json:"prizes" validate:"max=10,dive"`
	DisplayOrder int                 `json:"display_order" validate:"min=0"`
}

// prizes converts the payload rows into the store type. A nil slice becomes an
// empty one so the NOT NULL prizes column never receives a SQL NULL.
func (p TrackPayload) prizes() store.TrackPrizes {
	prizes := make(store.TrackPrizes, 0, len(p.Prizes))
	for _, prize := range p.Prizes {
		prizes = append(prizes, store.TrackPrize{Place: prize.Place, Prize: prize.Prize})
	}
	return prizes
}

type TrackListResponse struct {
	Tracks []store.Track `json:"tracks"`
}

type TrackEditPermissionResponse struct {
	Enabled bool `json:"enabled"`
}

// getTrackEditPermissionHandler returns whether the current user may edit tracks (Admin)
//
//	@Summary		Get track edit permission (Admin)
//	@Description	Returns whether the current user may create, update, or delete challenge tracks. Super admins are always allowed; admins depend on the admin track edit setting.
//	@Tags			admin/tracks
//	@Produce		json
//	@Success		200	{object}	TrackEditPermissionResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks/edit-permission [get]
func (app *application) getTrackEditPermissionHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	enabled := true
	if user.Role != store.RoleSuperAdmin {
		var err error
		enabled, err = app.store.Settings.GetAdminTrackEditEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
	}

	if err := app.jsonResponse(w, http.StatusOK, TrackEditPermissionResponse{Enabled: enabled}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// listTracksHandler returns all challenge tracks (Admin)
//
//	@Summary		List tracks (Admin)
//	@Description	Returns all challenge tracks ordered by display order
//	@Tags			admin/tracks
//	@Produce		json
//	@Success		200	{object}	TrackListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks [get]
func (app *application) listTracksHandler(w http.ResponseWriter, r *http.Request) {
	tracks, err := app.store.Tracks.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, TrackListResponse{Tracks: tracks}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createTrackHandler creates a new challenge track (Admin)
//
//	@Summary		Create track (Admin)
//	@Description	Creates a new challenge track
//	@Tags			admin/tracks
//	@Accept			json
//	@Produce		json
//	@Param			track	body		TrackPayload	true	"Track to create"
//	@Success		201		{object}	store.Track
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks [post]
func (app *application) createTrackHandler(w http.ResponseWriter, r *http.Request) {
	var payload TrackPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	track := &store.Track{
		Title:        payload.Title,
		SponsorName:  payload.SponsorName,
		Description:  payload.Description,
		Prizes:       payload.prizes(),
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.Tracks.Create(r.Context(), track); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, track); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateTrackHandler updates an existing challenge track (Admin)
//
//	@Summary		Update track (Admin)
//	@Description	Updates an existing challenge track. The logo is not touched here; use the logo endpoint.
//	@Tags			admin/tracks
//	@Accept			json
//	@Produce		json
//	@Param			trackID	path		string			true	"Track ID"
//	@Param			track	body		TrackPayload	true	"Track updates"
//	@Success		200		{object}	store.Track
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks/{trackID} [put]
func (app *application) updateTrackHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "trackID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing track ID"))
		return
	}

	var payload TrackPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	track := &store.Track{
		ID:           id,
		Title:        payload.Title,
		SponsorName:  payload.SponsorName,
		Description:  payload.Description,
		Prizes:       payload.prizes(),
		DisplayOrder: payload.DisplayOrder,
	}

	if err := app.store.Tracks.Update(r.Context(), track); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("track not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, track); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteTrackHandler deletes a challenge track (Admin)
//
//	@Summary		Delete track (Admin)
//	@Description	Deletes a challenge track
//	@Tags			admin/tracks
//	@Param			trackID	path	string	true	"Track ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks/{trackID} [delete]
func (app *application) deleteTrackHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "trackID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing track ID"))
		return
	}

	if err := app.store.Tracks.Delete(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("track not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// uploadTrackLogoHandler uploads a base64-encoded logo for a track (Admin)
//
//	@Summary		Upload track logo (Admin)
//	@Description	Uploads a base64-encoded logo image for a challenge track
//	@Tags			admin/tracks
//	@Accept			json
//	@Produce		json
//	@Param			trackID	path		string				true	"Track ID"
//	@Param			body	body		LogoUploadPayload	true	"Base64-encoded logo"
//	@Success		200		{object}	store.Track
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/tracks/{trackID}/logo [put]
func (app *application) uploadTrackLogoHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "trackID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing track ID"))
		return
	}

	if _, err := app.store.Tracks.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("track not found"))
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

	if len(decoded) > maxTrackLogoBytes {
		app.badRequestResponse(w, r, fmt.Errorf("logo exceeds maximum size of %d bytes", maxTrackLogoBytes))
		return
	}

	if err := app.store.Tracks.UpdateLogo(r.Context(), id, payload.LogoData, payload.ContentType); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("track not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	track, err := app.store.Tracks.GetByID(r.Context(), id)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, track); err != nil {
		app.internalServerError(w, r, err)
	}
}
