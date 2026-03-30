package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
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
		ID:              id,
		Name:            "Test Sponsor",
		Tier:            "Gold",
		LogoData:        "iVBORw0KGgo=",
		LogoContentType: "image/png",
		WebsiteURL:      "https://example.com",
		Description:     "A test sponsor.",
		DisplayOrder:    1,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

func TestListSponsors(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)

	t.Run("should list all sponsors", func(t *testing.T) {
		sponsors := []store.Sponsor{newTestSponsor("sponsor-1"), newTestSponsor("sponsor-2")}
		sponsors[1].LogoData = ""
		sponsors[1].LogoContentType = ""

		mockSponsors.On("List").Return(sponsors, nil).Once()

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
		assert.Equal(t, "iVBORw0KGgo=", body.Data.Sponsors[0].LogoData)
		assert.Equal(t, "image/png", body.Data.Sponsors[0].LogoContentType)
		assert.Empty(t, body.Data.Sponsors[1].LogoData)

		mockSponsors.AssertExpectations(t)
	})
}

func TestGetPublicSponsors(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)
	mux := app.mount()

	t.Run("should return sponsors with valid api key", func(t *testing.T) {
		sponsors := []store.Sponsor{newTestSponsor("sponsor-1")}
		mockSponsors.On("List").Return(sponsors, nil).Once()

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
			sponsor.ID = "new-sponsor"
		}).Return(nil).Once()

		body := `{"name":"New Sponsor","tier":"Platinum","website_url":"https://new.com","display_order":10}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createSponsorHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data store.Sponsor `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "new-sponsor", respBody.Data.ID)
		assert.Equal(t, "New Sponsor", respBody.Data.Name)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid payload", func(t *testing.T) {
		body := `{"name":""}`
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

		mockSponsors.On("Update", mock.AnythingOfType("*store.Sponsor")).Run(func(args mock.Arguments) {
			sponsor := args.Get(0).(*store.Sponsor)
			sponsor.CreatedAt = time.Now()
			sponsor.UpdatedAt = time.Now()
		}).Return(nil).Once()

		body := `{"name":"Updated Name","tier":"Gold","website_url":"https://example.com","display_order":1}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsorID)

		rr := executeRequest(req, http.HandlerFunc(app.updateSponsorHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data store.Sponsor `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "Updated Name", respBody.Data.Name)

		mockSponsors.AssertExpectations(t)
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

	t.Run("should delete a sponsor", func(t *testing.T) {
		mockSponsors.On("Delete", "sponsor-to-delete").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "sponsor-to-delete")

		rr := executeRequest(req, http.HandlerFunc(app.deleteSponsorHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 404 if sponsor not found", func(t *testing.T) {
		mockSponsors.On("Delete", "nonexistent").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.deleteSponsorHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}

func TestUploadLogo(t *testing.T) {
	app := newTestApplication(t)
	mockSponsors := app.store.Sponsors.(*store.MockSponsorsStore)

	validBase64 := base64.StdEncoding.EncodeToString([]byte("fake-png-data"))

	t.Run("should upload a logo", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()
		mockSponsors.On("UpdateLogo", sponsor.ID, validBase64, "image/png").Return(nil).Once()
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		reqBody := `{"logo_data":"` + validBase64 + `","content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.uploadLogoHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data store.Sponsor `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, sponsor.ID, body.Data.ID)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 404 if sponsor not found", func(t *testing.T) {
		mockSponsors.On("GetByID", "nonexistent").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPut, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.uploadLogoHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for unsupported content type", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		reqBody := `{"logo_data":"` + validBase64 + `","content_type":"application/pdf"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.uploadLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid base64", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		reqBody := `{"logo_data":"not-valid-base64!!!","content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.uploadLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSponsors.AssertExpectations(t)
	})

	t.Run("should return 400 for oversized image", func(t *testing.T) {
		sponsor := newTestSponsor("sponsor-1")
		mockSponsors.On("GetByID", sponsor.ID).Return(&sponsor, nil).Once()

		oversizedData := make([]byte, maxLogoBytes+1)
		oversizedBase64 := base64.StdEncoding.EncodeToString(oversizedData)

		reqBody := `{"logo_data":"` + oversizedBase64 + `","content_type":"image/png"}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withSponsorRouteParam(req, sponsor.ID)

		rr := executeRequest(req, http.HandlerFunc(app.uploadLogoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSponsors.AssertExpectations(t)
	})
}
