package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
)

// Cache lifetime for logo bytes fetched at a versioned URL. The version is the
// row's updated_at, so a new upload produces a new URL and the old one can be
// cached forever.
const publicLogoImmutableMaxAge = 365 * 24 * time.Hour

// Cache lifetime for logo bytes fetched without (or with a stale) version.
const publicLogoDefaultMaxAge = 5 * time.Minute

// PublicSponsor is the sponsor shape exposed on the public API. Logos are
// referenced by URL rather than inlined as base64 so consumers can cache them
// as images.
type PublicSponsor struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Tier         string    `json:"tier"`
	LogoURL      string    `json:"logo_url"`
	WebsiteURL   string    `json:"website_url"`
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type PublicSponsorListResponse struct {
	Sponsors []PublicSponsor `json:"sponsors"`
}

// PublicTrack is the challenge track shape exposed on the public API. See
// PublicSponsor for why the logo is a URL.
type PublicTrack struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	SponsorName  string            `json:"sponsor_name"`
	Description  string            `json:"description"`
	Prizes       store.TrackPrizes `json:"prizes"`
	LogoURL      string            `json:"logo_url"`
	DisplayOrder int               `json:"display_order"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

type PublicTrackListResponse struct {
	Tracks []PublicTrack `json:"tracks"`
}

func logoVersion(updatedAt time.Time) string {
	return strconv.FormatInt(updatedAt.Unix(), 10)
}

// publicLogoURL builds the absolute, versioned URL for a resource's logo, or ""
// when the row has no logo.
func (app *application) publicLogoURL(resource, id, logoData string, updatedAt time.Time) string {
	if logoData == "" {
		return ""
	}
	return fmt.Sprintf("%s/v1/public/%s/%s/logo?v=%s",
		strings.TrimRight(app.config.appURL, "/"), resource, id, logoVersion(updatedAt))
}

func (app *application) toPublicSponsor(s store.Sponsor) PublicSponsor {
	return PublicSponsor{
		ID:           s.ID,
		Name:         s.Name,
		Tier:         s.Tier,
		LogoURL:      app.publicLogoURL("sponsors", s.ID, s.LogoData, s.UpdatedAt),
		WebsiteURL:   s.WebsiteURL,
		Description:  s.Description,
		DisplayOrder: s.DisplayOrder,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}
}

func (app *application) toPublicTrack(t store.Track) PublicTrack {
	prizes := t.Prizes
	if prizes == nil {
		prizes = store.TrackPrizes{}
	}
	return PublicTrack{
		ID:           t.ID,
		Title:        t.Title,
		SponsorName:  t.SponsorName,
		Description:  t.Description,
		Prizes:       prizes,
		LogoURL:      app.publicLogoURL("tracks", t.ID, t.LogoData, t.UpdatedAt),
		DisplayOrder: t.DisplayOrder,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}
}

// serveLogo writes a stored base64 logo as raw image bytes with cache headers.
// The response is immutable only when the request carries the current version,
// so a stale or missing ?v never pins an old logo in a shared cache.
func (app *application) serveLogo(w http.ResponseWriter, r *http.Request, logoData, contentType string, updatedAt time.Time) {
	if logoData == "" || contentType == "" {
		app.notFoundResponse(w, r, errors.New("logo not found"))
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(logoData)
	if err != nil {
		app.internalServerError(w, r, fmt.Errorf("stored logo is not valid base64: %w", err))
		return
	}

	version := logoVersion(updatedAt)
	etag := `"` + version + `"`

	cacheControl := fmt.Sprintf("public, max-age=%d", int(publicLogoDefaultMaxAge.Seconds()))
	if r.URL.Query().Get("v") == version {
		cacheControl = fmt.Sprintf("public, max-age=%d, immutable", int(publicLogoImmutableMaxAge.Seconds()))
	}

	w.Header().Set("Cache-Control", cacheControl)
	w.Header().Set("ETag", etag)

	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", strconv.Itoa(len(decoded)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(decoded); err != nil {
		app.requestLogger(r).Warnw("failed to write logo response", "error", err)
	}
}

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

// getPublicSponsorsHandler returns all sponsors (public, API key auth)
//
//	@Summary		Get sponsors (Public)
//	@Description	Returns all sponsors, ordered by display order. Each sponsor's logo is referenced by logo_url (an absolute, versioned URL to /public/sponsors/{sponsorID}/logo), or "" when the sponsor has no logo. Logo bytes are not inlined.
//	@Tags			public
//	@Produce		json
//	@Param			X-API-Key	header		string	true	"API Key"
//	@Success		200			{object}	PublicSponsorListResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Router			/public/sponsors [get]
func (app *application) getPublicSponsorsHandler(w http.ResponseWriter, r *http.Request) {
	sponsors, err := app.store.Sponsors.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	out := make([]PublicSponsor, 0, len(sponsors))
	for _, s := range sponsors {
		out = append(out, app.toPublicSponsor(s))
	}

	if err := app.jsonResponse(w, http.StatusOK, PublicSponsorListResponse{Sponsors: out}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPublicSponsorLogoHandler serves a sponsor's logo as an image (public, no auth)
//
//	@Summary		Get sponsor logo (Public)
//	@Description	Returns the sponsor's logo as raw image bytes with the stored content type. No API key is required so the URL can be used directly in an <img> tag or by an image optimizer. Responses carry an ETag; when ?v matches the current version the response is immutable for a year, otherwise it is cacheable for five minutes.
//	@Tags			public
//	@Produce		image/png
//	@Produce		image/jpeg
//	@Produce		image/webp
//	@Produce		image/gif
//	@Param			sponsorID	path	string	true	"Sponsor ID"
//	@Param			v			query	string	false	"Logo version (updated_at as unix seconds), as embedded in logo_url"
//	@Success		200			{file}	binary
//	@Success		304
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Router			/public/sponsors/{sponsorID}/logo [get]
func (app *application) getPublicSponsorLogoHandler(w http.ResponseWriter, r *http.Request) {
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

	app.serveLogo(w, r, sponsor.LogoData, sponsor.LogoContentType, sponsor.UpdatedAt)
}

// getPublicFAQHandler returns all FAQs (public, API key auth)
//
//	@Summary		Get FAQs (Public)
//	@Description	Returns all frequently asked questions, ordered by display order
//	@Tags			public
//	@Produce		json
//	@Param			X-API-Key	header		string	true	"API Key"
//	@Success		200			{object}	FAQListResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Router			/public/faq [get]
func (app *application) getPublicFAQHandler(w http.ResponseWriter, r *http.Request) {
	app.listFAQsHandler(w, r)
}

// getPublicTracksHandler returns all challenge tracks (public, API key auth)
//
//	@Summary		Get tracks (Public)
//	@Description	Returns all challenge tracks, ordered by display order. Each track's logo is referenced by logo_url (an absolute, versioned URL to /public/tracks/{trackID}/logo), or "" when the track has no logo. Logo bytes are not inlined.
//	@Tags			public
//	@Produce		json
//	@Param			X-API-Key	header		string	true	"API Key"
//	@Success		200			{object}	PublicTrackListResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Router			/public/tracks [get]
func (app *application) getPublicTracksHandler(w http.ResponseWriter, r *http.Request) {
	tracks, err := app.store.Tracks.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	out := make([]PublicTrack, 0, len(tracks))
	for _, t := range tracks {
		out = append(out, app.toPublicTrack(t))
	}

	if err := app.jsonResponse(w, http.StatusOK, PublicTrackListResponse{Tracks: out}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPublicTrackLogoHandler serves a track's logo as an image (public, no auth)
//
//	@Summary		Get track logo (Public)
//	@Description	Returns the track's logo as raw image bytes with the stored content type. No API key is required so the URL can be used directly in an <img> tag or by an image optimizer. Responses carry an ETag; when ?v matches the current version the response is immutable for a year, otherwise it is cacheable for five minutes.
//	@Tags			public
//	@Produce		image/png
//	@Produce		image/jpeg
//	@Produce		image/webp
//	@Produce		image/gif
//	@Param			trackID	path	string	true	"Track ID"
//	@Param			v		query	string	false	"Logo version (updated_at as unix seconds), as embedded in logo_url"
//	@Success		200		{file}	binary
//	@Success		304
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Router			/public/tracks/{trackID}/logo [get]
func (app *application) getPublicTrackLogoHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "trackID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing track ID"))
		return
	}

	track, err := app.store.Tracks.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("track not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.serveLogo(w, r, track.LogoData, track.LogoContentType, track.UpdatedAt)
}
