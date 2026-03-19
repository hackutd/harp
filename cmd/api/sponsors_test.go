package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/gcs"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// withSponsorRouteParam is a helper to add a URL parameter to a request for testing.
func withSponsorRouteParam(req *http.Request, sponsorID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("sponsorID", sponsorID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func newTestSponsor(id string) store.Sponsor {
	return store.Sponsor{
		ID:           id,
		Name:         "Test Sponsor",
		Tier:         "Gold",
		LogoPath:     "sponsors/test-sponsor/logo.png",
		WebsiteURL:   "https://example.com",
		Description:  "A test sponsor.",
		DisplayOrder: 1,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func TestListSponsors(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should list all sponsors", func(t *testing.T) {
		sponsors := []store.Sponsor{newTestSponsor("sponsor-1"), newTestSponsor("sponsor-2")}
		sponsors[1].LogoPath = "" // Test one without a logo

		mockSponsors.On("List").Return(sponsors, nil).Once()
		mockGCS.On("GeneratePublicURL", sponsors[0].LogoPath).Return("https://public.url/logo.png").Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listSponsorsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SponsorListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Sponsors, 2)
		assert.Equal(t, "https://public.url/logo.png", body.Data.Sponsors[0].LogoURL)
		assert.Empty(t, body.Data.Sponsors[1].LogoURL)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})
}

func TestGetPublicSponsors(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)
	mux := app.mount()

	t.Run("should return sponsors with valid api key", func(t *testing.T) {
		sponsors := []store.Sponsor{newTestSponsor("sponsor-1")}
		mockSponsors.On("List").Return(sponsors, nil).Once()
		mockGCS.On("GeneratePublicURL", sponsors[0].LogoPath).Return("https://public.url/logo.png").Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data SponsorListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Sponsors, 1)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 401 with invalid api key", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/public/sponsors", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "wrong-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}

func TestCreateSponsor(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)

	t.Run("should create a sponsor", func(t *testing.T) {
		mockSponsors.On("Create", mock.AnythingOfType("*store.Sponsor")).Run(func(args mock.Arguments) {
			sponsor := args.Get(0).(*store.Sponsor)
			sponsor.ID = "new-sponsor" // Simulate DB setting ID
		}).Return(nil).Once()

		body := `{"name":"New Sponsor","tier":"Platinum","website_url":"https://new.com","display_order":10}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createSponsorHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data SponsorResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "new-sponsor", respBody.Data.ID)
		assert.Equal(t, "New Sponsor", respBody.Data.Name)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid payload", func(t *testing.T) {
		body := `{"name":""}` // Name is required
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createSponsorHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateSponsor(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)

	t.Run("should update a sponsor", func(t *testing.T) {
		sponsorID := "sponsor-to-update"
		updatedSponsor := newTestSponsor(sponsorID)
		updatedSponsor.Name = "Updated Name"

		mockSponsors.On("Update", mock.AnythingOfType("*store.Sponsor")).Return(nil).Once()
		mockSponsors.On("GetByID", sponsorID).Return(&updatedSponsor, nil).Once()

		mockGCS := app.gcsClient.(*gcs.MockClient)
		mockGCS.On("GeneratePublicURL", updatedSponsor.LogoPath).
			Return("https://public.url/logo.png").Once()

		body := `{"name":"Updated Name","tier":"Gold","website_url":"https://example.com","display_order":1}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsorID)

		rr := executeRequest(req, http.HandlerFunc(app.updateSponsorHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data SponsorResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "Updated Name", respBody.Data.Name)
		assert.Equal(t, "https://public.url/logo.png", respBody.Data.LogoURL)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 if sponsor not found", func(t *testing.T) {
		mockSponsors.On("Update", mock.AnythingOfType("*store.Sponsor")).Return(store.ErrNotFound).Once()

		body := `{"name":"Updated Name","tier":"Gold","display_order":1}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.updateSponsorHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}

func TestDeleteSponsor(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should delete a sponsor and its logo", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-to-delete")

		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()
		mockSponsors.On("Delete", sponsor.ID).Return(nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, sponsor.LogoPath).Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.deleteSponsorHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 if sponsor not found", func(t *testing.T) {
		mockSponsors.On("GetByID", "nonexistent").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.deleteSponsorHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}

func TestGenerateLogoUploadURL(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should generate an upload url", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()
		mockGCS.On("GenerateImageUploadURL", mock.Anything, mock.MatchedBy(func(path string) bool {
			return strings.HasPrefix(path, "sponsors/"+sponsor.ID+"/")
		}), "image/png").Return("https://upload.url/logo", nil).Once()

		reqBody := `{"content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data LogoUploadURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, "https://upload.url/logo", body.Data.UploadURL)
		assert.True(t, strings.HasPrefix(body.Data.LogoPath, "sponsors/"+sponsor.ID+"/"))
		assert.Equal(t, "image/png", body.Data.ContentType)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 if sponsor not found", func(t *testing.T) {
		mockSponsors.On("GetByID", "nonexistent").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 503 if gcs is not configured", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()
		app.gcsClient = nil

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)

		app.gcsClient = mockGCS // Restore for other tests
		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 500 if url generation fails", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()
		mockGCS.On("GenerateImageUploadURL", mock.Anything, mock.AnythingOfType("string"), "image/png").Return("", errors.New("gcs error")).Once()

		reqBody := `{"content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockSponsors.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 400 for missing content_type", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		reqBody := `{}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for unsupported content_type", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		reqBody := `{"content_type":"application/pdf"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.generateLogoUploadURLHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}
