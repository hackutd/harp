package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// withTrackRouteParam is a helper to add a URL parameter to a request for testing.
func withTrackRouteParam(req *http.Request, trackID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("trackID", trackID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// protectedTrackMutationRouter mounts the mutating handlers behind the edit
// permission middleware so the gate actually runs.
func protectedTrackMutationRouter(app *application) chi.Router {
	r := chi.NewRouter()
	r.With(app.AdminTrackEditPermissionMiddleware).Post("/", app.createTrackHandler)
	r.With(app.AdminTrackEditPermissionMiddleware).Put("/{trackID}", app.updateTrackHandler)
	r.With(app.AdminTrackEditPermissionMiddleware).Delete("/{trackID}", app.deleteTrackHandler)
	return r
}

func newTestTrack(id string) store.Track {
	return store.Track{
		ID:          id,
		Title:       "Best Financial Hack",
		SponsorName: "Capital One",
		Description: "Your chance to change the game in fintech.",
		Prizes: store.TrackPrizes{
			{Place: "1st", Prize: "$300 Amazon gift card"},
		},
		DisplayOrder: 1,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func TestListTracks(t *testing.T) {
	t.Run("should list all tracks", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		tracks := []store.Track{newTestTrack("track-1"), newTestTrack("track-2")}
		mockTracks.On("List").Return(tracks, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listTracksHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackListResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Len(t, body.Data.Tracks, 2)
		assert.Equal(t, "Best Financial Hack", body.Data.Tracks[0].Title)
		assert.Equal(t, "Capital One", body.Data.Tracks[0].SponsorName)
		require.Len(t, body.Data.Tracks[0].Prizes, 1)
		assert.Equal(t, "1st", body.Data.Tracks[0].Prizes[0].Place)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return an empty list", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("List").Return([]store.Track{}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listTracksHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackListResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Empty(t, body.Data.Tracks)

		mockTracks.AssertExpectations(t)
	})
}

func TestGetTrackEditPermission(t *testing.T) {
	t.Run("should return enabled for an admin when the setting is on", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetAdminTrackEditEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTrackEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return disabled for an admin when the setting is off", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetAdminTrackEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTrackEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.False(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should always return enabled for a super admin without reading the setting", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTrackEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Enabled)

		// No expectation was registered: the super admin path must not read the setting.
		mockSettings.AssertExpectations(t)
	})
}

func TestGetPublicTracks(t *testing.T) {
	t.Run("should return tracks with a valid api key", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mux := app.mount()

		mockTracks.On("List").Return([]store.Track{newTestTrack("track-1")}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TrackListResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Len(t, body.Data.Tracks, 1)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 401 without an api key", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 401 with an invalid api key", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/tracks", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "wrong-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}

func TestCreateTrack(t *testing.T) {
	t.Run("should create a track", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Create", mock.AnythingOfType("*store.Track")).Run(func(args mock.Arguments) {
			track := args.Get(0).(*store.Track)
			track.ID = "new-track"
		}).Return(nil).Once()

		body := `{"title":"Agents That Act","sponsor_name":"NVIDIA","description":"Build an agent.","prizes":[{"place":"1st","prize":"3x RTX 5080 GPUs"}],"display_order":2}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTrackHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data store.Track `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&respBody))
		assert.Equal(t, "new-track", respBody.Data.ID)
		assert.Equal(t, "NVIDIA", respBody.Data.SponsorName)
		require.Len(t, respBody.Data.Prizes, 1)
		assert.Equal(t, "3x RTX 5080 GPUs", respBody.Data.Prizes[0].Prize)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should default a missing prizes field to an empty list", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Create", mock.MatchedBy(func(track *store.Track) bool {
			return track.Prizes != nil && len(track.Prizes) == 0
		})).Return(nil).Once()

		body := `{"title":"Beginner Track","sponsor_name":"","description":"","display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTrackHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 400 when the title is empty", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"title":"","sponsor_name":"NVIDIA","description":"","prizes":[],"display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTrackHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when a prize row is missing its place", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"title":"Agents That Act","sponsor_name":"NVIDIA","description":"","prizes":[{"place":"","prize":"A GPU"}],"display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTrackHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateTrack(t *testing.T) {
	t.Run("should update a track", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Update", mock.AnythingOfType("*store.Track")).Return(nil).Once()

		body := `{"title":"Updated Track","sponsor_name":"Toyota","description":"Find your dream car.","prizes":[{"place":"1st","prize":"$500 Amazon gift card"}],"display_order":3}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateTrackHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data store.Track `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&respBody))
		assert.Equal(t, "track-1", respBody.Data.ID)
		assert.Equal(t, "Updated Track", respBody.Data.Title)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 404 when the track does not exist", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Update", mock.AnythingOfType("*store.Track")).Return(store.ErrNotFound).Once()

		body := `{"title":"Missing","sponsor_name":"","description":"","prizes":[],"display_order":0}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "missing")

		rr := executeRequest(req, http.HandlerFunc(app.updateTrackHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTracks.AssertExpectations(t)
	})
}

func TestDeleteTrack(t *testing.T) {
	t.Run("should delete a track", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Delete", "track-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.deleteTrackHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 404 when the track does not exist", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("Delete", "missing").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "missing")

		rr := executeRequest(req, http.HandlerFunc(app.deleteTrackHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTracks.AssertExpectations(t)
	})
}

func TestUploadTrackLogo(t *testing.T) {
	logoData := base64.StdEncoding.EncodeToString([]byte("fake-png-bytes"))

	t.Run("should upload a logo", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		existing := newTestTrack("track-1")
		updated := newTestTrack("track-1")
		updated.LogoData = logoData
		updated.LogoContentType = "image/png"

		// Once for the existence check, once to return the refreshed row.
		mockTracks.On("GetByID", "track-1").Return(&existing, nil).Once()
		mockTracks.On("UpdateLogo", "track-1", logoData, "image/png").Return(nil).Once()
		mockTracks.On("GetByID", "track-1").Return(&updated, nil).Once()

		body := fmt.Sprintf(`{"logo_data":%q,"content_type":"image/png"}`, logoData)
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.uploadTrackLogoHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data store.Track `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&respBody))
		assert.Equal(t, logoData, respBody.Data.LogoData)
		assert.Equal(t, "image/png", respBody.Data.LogoContentType)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 404 when the track does not exist", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		mockTracks.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		body := fmt.Sprintf(`{"logo_data":%q,"content_type":"image/png"}`, logoData)
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "missing")

		rr := executeRequest(req, http.HandlerFunc(app.uploadTrackLogoHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 400 for an unsupported content type", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		existing := newTestTrack("track-1")
		mockTracks.On("GetByID", "track-1").Return(&existing, nil).Once()

		body := fmt.Sprintf(`{"logo_data":%q,"content_type":"application/pdf"}`, logoData)
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.uploadTrackLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid base64", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		existing := newTestTrack("track-1")
		mockTracks.On("GetByID", "track-1").Return(&existing, nil).Once()

		body := `{"logo_data":"not-valid-base64!!!","content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.uploadTrackLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should return 400 when the logo exceeds the size limit", func(t *testing.T) {
		app := newTestApplication(t)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)

		existing := newTestTrack("track-1")
		mockTracks.On("GetByID", "track-1").Return(&existing, nil).Once()

		oversized := base64.StdEncoding.EncodeToString(make([]byte, maxTrackLogoBytes+1))
		body := fmt.Sprintf(`{"logo_data":%q,"content_type":"image/png"}`, oversized)
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withTrackRouteParam(req, "track-1")

		rr := executeRequest(req, http.HandlerFunc(app.uploadTrackLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockTracks.AssertExpectations(t)
	})
}

func TestTrackMutationPermission(t *testing.T) {
	const validBody = `{"title":"Agents That Act","sponsor_name":"NVIDIA","description":"","prizes":[],"display_order":0}`

	t.Run("should return 403 for an admin creating when editing is disabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).
			On("GetAdminTrackEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(validBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, protectedTrackMutationRouter(app))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should return 403 for an admin updating when editing is disabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).
			On("GetAdminTrackEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/track-1", strings.NewReader(validBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, protectedTrackMutationRouter(app))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should return 403 for an admin deleting when editing is disabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).
			On("GetAdminTrackEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/track-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, protectedTrackMutationRouter(app))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should allow an admin to create when editing is enabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).
			On("GetAdminTrackEditEnabled").Return(true, nil).Once()
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mockTracks.On("Create", mock.AnythingOfType("*store.Track")).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(validBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, protectedTrackMutationRouter(app))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockTracks.AssertExpectations(t)
	})

	t.Run("should allow a super admin to create when editing is disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockTracks := app.store.Tracks.(*store.MockTracksStore)
		mockTracks.On("Create", mock.AnythingOfType("*store.Track")).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(validBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, protectedTrackMutationRouter(app))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		// No settings expectation: the super admin short-circuits before the read.
		mockSettings.AssertExpectations(t)
		mockTracks.AssertExpectations(t)
	})
}
