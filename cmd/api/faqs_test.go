package main

import (
	"context"
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

// withFAQRouteParam is a helper to add a URL parameter to a request for testing.
func withFAQRouteParam(req *http.Request, faqID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("faqID", faqID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func newTestFAQ(id string) store.FAQ {
	return store.FAQ{
		ID:           id,
		Question:     "What is HackUTD?",
		Answer:       "The largest hackathon in Texas.",
		DisplayOrder: 1,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func TestListFAQs(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)

	t.Run("should list all FAQs", func(t *testing.T) {
		faqs := []store.FAQ{newTestFAQ("faq-1"), newTestFAQ("faq-2")}
		mockFAQs.On("List").Return(faqs, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listFAQsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.FAQs, 2)
		assert.Equal(t, "What is HackUTD?", body.Data.FAQs[0].Question)

		mockFAQs.AssertExpectations(t)
	})
}

func TestGetHackerFAQ(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)

	t.Run("should return FAQs for an authenticated hacker", func(t *testing.T) {
		faqs := []store.FAQ{newTestFAQ("faq-1")}
		mockFAQs.On("List").Return(faqs, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getHackerFAQHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.FAQs, 1)

		mockFAQs.AssertExpectations(t)
	})
}

func TestGetFAQEditPermission(t *testing.T) {
	t.Run("returns enabled true for admin when admin FAQ edits are enabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetAdminFAQEditEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getFAQEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Enabled)
		mockSettings.AssertExpectations(t)
	})

	t.Run("returns enabled false for admin when admin FAQ edits are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetAdminFAQEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getFAQEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.False(t, body.Data.Enabled)
		mockSettings.AssertExpectations(t)
	})

	t.Run("returns enabled true for super admin without reading the setting", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getFAQEditPermissionHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQEditPermissionResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Enabled)
		// No mock expectation — super admin path must not read the setting
	})
}

func TestGetPublicFAQ(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)
	mux := app.mount()

	t.Run("should return FAQs with valid api key", func(t *testing.T) {
		faqs := []store.FAQ{newTestFAQ("faq-1")}
		mockFAQs.On("List").Return(faqs, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/faq", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data FAQListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.FAQs, 1)

		mockFAQs.AssertExpectations(t)
	})

	t.Run("should return 401 with invalid api key", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/public/faq", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "wrong-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}

func TestCreateFAQ(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)

	t.Run("should create a FAQ", func(t *testing.T) {
		mockFAQs.On("Create", mock.AnythingOfType("*store.FAQ")).Run(func(args mock.Arguments) {
			faq := args.Get(0).(*store.FAQ)
			faq.ID = "new-faq"
		}).Return(nil).Once()

		body := `{"question":"When is it?","answer":"In the fall.","display_order":2}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createFAQHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data store.FAQ `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "new-faq", respBody.Data.ID)
		assert.Equal(t, "When is it?", respBody.Data.Question)

		mockFAQs.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid payload", func(t *testing.T) {
		body := `{"question":"","answer":""}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createFAQHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateFAQ(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)

	t.Run("should update a FAQ", func(t *testing.T) {
		mockFAQs.On("Update", mock.AnythingOfType("*store.FAQ")).Run(func(args mock.Arguments) {
			faq := args.Get(0).(*store.FAQ)
			faq.CreatedAt = time.Now()
			faq.UpdatedAt = time.Now()
		}).Return(nil).Once()

		body := `{"question":"Updated question?","answer":"Updated answer.","display_order":1}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withFAQRouteParam(req, "faq-to-update")

		rr := executeRequest(req, http.HandlerFunc(app.updateFAQHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data store.FAQ `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "Updated question?", respBody.Data.Question)

		mockFAQs.AssertExpectations(t)
	})

	t.Run("should return 404 if FAQ not found", func(t *testing.T) {
		mockFAQs.On("Update", mock.AnythingOfType("*store.FAQ")).Return(store.ErrNotFound).Once()

		body := `{"question":"Updated question?","answer":"Updated answer.","display_order":1}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withFAQRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.updateFAQHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockFAQs.AssertExpectations(t)
	})
}

func TestDeleteFAQ(t *testing.T) {
	app := newTestApplication(t)
	mockFAQs := app.store.FAQs.(*store.MockFAQsStore)

	t.Run("should delete a FAQ", func(t *testing.T) {
		mockFAQs.On("Delete", "faq-to-delete").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withFAQRouteParam(req, "faq-to-delete")

		rr := executeRequest(req, http.HandlerFunc(app.deleteFAQHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockFAQs.AssertExpectations(t)
	})

	t.Run("should return 404 if FAQ not found", func(t *testing.T) {
		mockFAQs.On("Delete", "nonexistent").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withFAQRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.deleteFAQHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockFAQs.AssertExpectations(t)
	})
}

func protectedFAQMutationRouter(app *application) chi.Router {
	r := chi.NewRouter()
	r.With(app.AdminFAQEditPermissionMiddleware).Post("/", app.createFAQHandler)
	r.With(app.AdminFAQEditPermissionMiddleware).Put("/{faqID}", app.updateFAQHandler)
	r.With(app.AdminFAQEditPermissionMiddleware).Delete("/{faqID}", app.deleteFAQHandler)
	return r
}

func TestFAQMutationPermission(t *testing.T) {
	t.Run("admin receives 403 for create when admin FAQ edits are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		r := protectedFAQMutationRouter(app)

		mockSettings.On("GetAdminFAQEditEnabled").Return(false, nil).Once()

		body := `{"question":"Q?","answer":"A.","display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		mockSettings.AssertExpectations(t)
	})

	t.Run("admin receives 403 for update when admin FAQ edits are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		r := protectedFAQMutationRouter(app)

		mockSettings.On("GetAdminFAQEditEnabled").Return(false, nil).Once()

		body := `{"question":"Q?","answer":"A.","display_order":0}`
		req, err := http.NewRequest(http.MethodPut, "/faq-1", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		mockSettings.AssertExpectations(t)
	})

	t.Run("admin receives 403 for delete when admin FAQ edits are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		r := protectedFAQMutationRouter(app)

		mockSettings.On("GetAdminFAQEditEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/faq-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		mockSettings.AssertExpectations(t)
	})

	t.Run("admin can create when admin FAQ edits are enabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockFAQs := app.store.FAQs.(*store.MockFAQsStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		r := protectedFAQMutationRouter(app)

		mockSettings.On("GetAdminFAQEditEnabled").Return(true, nil).Once()
		mockFAQs.On("Create", mock.AnythingOfType("*store.FAQ")).Return(nil).Once()

		body := `{"question":"Q?","answer":"A.","display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockSettings.AssertExpectations(t)
		mockFAQs.AssertExpectations(t)
	})

	t.Run("super admin can create when admin FAQ edits are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockFAQs := app.store.FAQs.(*store.MockFAQsStore)
		r := protectedFAQMutationRouter(app)

		mockFAQs.On("Create", mock.AnythingOfType("*store.FAQ")).Return(nil).Once()

		body := `{"question":"Q?","answer":"A.","display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockFAQs.AssertExpectations(t)
	})
}
