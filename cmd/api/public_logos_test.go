package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testLogoBytes = []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}

func testLogoUpdatedAt() time.Time {
	return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
}

func testSponsorWithLogo() *store.Sponsor {
	return &store.Sponsor{
		ID:              "sponsor-1",
		Name:            "Acme",
		Tier:            "gold",
		LogoData:        base64.StdEncoding.EncodeToString(testLogoBytes),
		LogoContentType: "image/png",
		WebsiteURL:      "https://acme.example",
		DisplayOrder:    1,
		CreatedAt:       testLogoUpdatedAt(),
		UpdatedAt:       testLogoUpdatedAt(),
	}
}

func testTrackWithLogo() *store.Track {
	return &store.Track{
		ID:              "track-1",
		Title:           "Best Use of Acme",
		SponsorName:     "Acme",
		Prizes:          store.TrackPrizes{{Place: "1st", Prize: "Widget"}},
		LogoData:        base64.StdEncoding.EncodeToString(testLogoBytes),
		LogoContentType: "image/webp",
		DisplayOrder:    1,
		CreatedAt:       testLogoUpdatedAt(),
		UpdatedAt:       testLogoUpdatedAt(),
	}
}

func TestGetPublicSponsorsLogoURL(t *testing.T) {
	t.Run("returns logo_url instead of inline logo data", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		withLogo := testSponsorWithLogo()
		noLogo := &store.Sponsor{ID: "sponsor-2", Name: "NoLogo", Tier: "silver", DisplayOrder: 2}
		mockSponsors.On("List").Return([]store.Sponsor{*withLogo, *noLogo}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var raw struct {
			Data struct {
				Sponsors []map[string]json.RawMessage `json:"sponsors"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &raw))
		require.Len(t, raw.Data.Sponsors, 2)

		for _, s := range raw.Data.Sponsors {
			assert.NotContains(t, s, "logo_data")
			assert.NotContains(t, s, "logo_content_type")
			assert.Contains(t, s, "logo_url")
		}

		var body struct {
			Data PublicSponsorListResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
		wantURL := "http://localhost:8080/v1/public/sponsors/sponsor-1/logo?v=" +
			strconv.FormatInt(testLogoUpdatedAt().Unix(), 10)
		assert.Equal(t, wantURL, body.Data.Sponsors[0].LogoURL)
		assert.Equal(t, "", body.Data.Sponsors[1].LogoURL)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("returns 500 on store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("List").Return(nil, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}

func TestGetPublicTracksLogoURL(t *testing.T) {
	t.Run("returns logo_url instead of inline logo data", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mux := app.mount()

		withLogo := testTrackWithLogo()
		noLogo := &store.Track{ID: "track-2", Title: "NoLogo", DisplayOrder: 2}
		mockTracks.On("List").Return([]store.Track{*withLogo, *noLogo}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var raw struct {
			Data struct {
				Tracks []map[string]json.RawMessage `json:"tracks"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &raw))
		require.Len(t, raw.Data.Tracks, 2)
		for _, tr := range raw.Data.Tracks {
			assert.NotContains(t, tr, "logo_data")
			assert.NotContains(t, tr, "logo_content_type")
			assert.Contains(t, tr, "logo_url")
		}
		assert.JSONEq(t, `[]`, string(raw.Data.Tracks[1]["prizes"]))

		var body struct {
			Data PublicTrackListResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
		wantURL := "http://localhost:8080/v1/public/tracks/track-1/logo?v=" +
			strconv.FormatInt(testLogoUpdatedAt().Unix(), 10)
		assert.Equal(t, wantURL, body.Data.Tracks[0].LogoURL)
		assert.Equal(t, "", body.Data.Tracks[1].LogoURL)

		mockTracks.AssertExpectations(t)
	})
}

func TestGetPublicSponsorLogo(t *testing.T) {
	version := strconv.FormatInt(testLogoUpdatedAt().Unix(), 10)

	t.Run("serves image bytes without API key", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "sponsor-1").Return(testSponsorWithLogo(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors/sponsor-1/logo?v="+version, nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "image/png", rr.Header().Get("Content-Type"))
		assert.Equal(t, "public, max-age=31536000, immutable", rr.Header().Get("Cache-Control"))
		assert.Equal(t, `"`+version+`"`, rr.Header().Get("ETag"))
		assert.Equal(t, "nosniff", rr.Header().Get("X-Content-Type-Options"))
		assert.Equal(t, testLogoBytes, rr.Body.Bytes())

		mockSponsors.AssertExpectations(t)
	})

	t.Run("is not immutable when version is missing or stale", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "sponsor-1").Return(testSponsorWithLogo(), nil).Twice()

		for _, path := range []string{
			"/v1/public/sponsors/sponsor-1/logo",
			"/v1/public/sponsors/sponsor-1/logo?v=123",
		} {
			req, err := http.NewRequest(http.MethodGet, path, nil)
			require.NoError(t, err)

			rr := executeRequest(req, mux)
			checkResponseCode(t, http.StatusOK, rr.Code)
			assert.Equal(t, "public, max-age=300", rr.Header().Get("Cache-Control"), path)
			assert.Equal(t, testLogoBytes, rr.Body.Bytes())
		}

		mockSponsors.AssertExpectations(t)
	})

	t.Run("returns 304 when If-None-Match matches", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "sponsor-1").Return(testSponsorWithLogo(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors/sponsor-1/logo?v="+version, nil)
		require.NoError(t, err)
		req.Header.Set("If-None-Match", `"`+version+`"`)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNotModified, rr.Code)
		assert.Empty(t, rr.Body.Bytes())
		assert.Equal(t, `"`+version+`"`, rr.Header().Get("ETag"))

		mockSponsors.AssertExpectations(t)
	})

	t.Run("returns 404 when sponsor has no logo", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "sponsor-2").Return(&store.Sponsor{ID: "sponsor-2", Name: "NoLogo"}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors/sponsor-2/logo", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("returns 404 when sponsor does not exist", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors/missing/logo", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("returns 500 on store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
		mux := app.mount()

		mockSponsors.On("GetByID", "sponsor-1").Return(nil, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors/sponsor-1/logo", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}

func TestGetPublicTrackLogo(t *testing.T) {
	version := strconv.FormatInt(testLogoUpdatedAt().Unix(), 10)

	t.Run("serves image bytes without API key", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mux := app.mount()

		mockTracks.On("GetByID", "track-1").Return(testTrackWithLogo(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks/track-1/logo?v="+version, nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Equal(t, "image/webp", rr.Header().Get("Content-Type"))
		assert.Equal(t, "public, max-age=31536000, immutable", rr.Header().Get("Cache-Control"))
		assert.Equal(t, `"`+version+`"`, rr.Header().Get("ETag"))
		assert.Equal(t, testLogoBytes, rr.Body.Bytes())

		mockTracks.AssertExpectations(t)
	})

	t.Run("returns 404 when track has no logo", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mux := app.mount()

		mockTracks.On("GetByID", "track-2").Return(&store.Track{ID: "track-2", Title: "NoLogo"}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks/track-2/logo", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("returns 404 when track does not exist", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mux := app.mount()

		mockTracks.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks/missing/logo", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTracks.AssertExpectations(t)
	})
}
