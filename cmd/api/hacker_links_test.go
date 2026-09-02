package main

import (
	"context"
	"encoding/json"
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

// withHackerLinkRouteParam is a helper to add a URL parameter to a request for testing.
func withHackerLinkRouteParam(req *http.Request, linkID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("linkID", linkID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func newTestHackerLink(id string) store.HackerLink {
	return store.HackerLink{
		ID:           id,
		Label:        "Devpost",
		URL:          "https://devpost.com",
		Icon:         "devpost",
		DisplayOrder: 0,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func TestListHackerLinks(t *testing.T) {
	app := newTestApplication(t)
	mockLinks := app.store.HackerLinks.(*store.MockHackerLinksStore)

	t.Run("should list all hacker links", func(t *testing.T) {
		links := []store.HackerLink{newTestHackerLink("link-1"), newTestHackerLink("link-2")}
		mockLinks.On("List").Return(links, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listHackerLinksHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data HackerLinkListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.HackerLinks, 2)
		assert.Equal(t, "Devpost", body.Data.HackerLinks[0].Label)

		mockLinks.AssertExpectations(t)
	})
}

func TestGetHackerLinks(t *testing.T) {
	app := newTestApplication(t)
	mockLinks := app.store.HackerLinks.(*store.MockHackerLinksStore)

	t.Run("should return hacker links for an authenticated hacker", func(t *testing.T) {
		links := []store.HackerLink{newTestHackerLink("link-1")}
		mockLinks.On("List").Return(links, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getHackerLinksHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data HackerLinkListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.HackerLinks, 1)

		mockLinks.AssertExpectations(t)
	})
}

func TestCreateHackerLink(t *testing.T) {
	app := newTestApplication(t)
	mockLinks := app.store.HackerLinks.(*store.MockHackerLinksStore)

	t.Run("should create a hacker link", func(t *testing.T) {
		mockLinks.On("Create", mock.AnythingOfType("*store.HackerLink")).Run(func(args mock.Arguments) {
			link := args.Get(0).(*store.HackerLink)
			link.ID = "new-link"
		}).Return(nil).Once()

		body := `{"label":"Discord","url":"https://discord.gg/hackutd","icon":"discord","display_order":1}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createHackerLinkHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data store.HackerLink `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "new-link", respBody.Data.ID)
		assert.Equal(t, "Discord", respBody.Data.Label)

		mockLinks.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid payload", func(t *testing.T) {
		body := `{"label":"","url":"not-a-url","icon":"discord"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createHackerLinkHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for unknown icon", func(t *testing.T) {
		body := `{"label":"Site","url":"https://example.com","icon":"unknown","display_order":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createHackerLinkHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateHackerLink(t *testing.T) {
	app := newTestApplication(t)
	mockLinks := app.store.HackerLinks.(*store.MockHackerLinksStore)

	t.Run("should update a hacker link", func(t *testing.T) {
		mockLinks.On("Update", mock.AnythingOfType("*store.HackerLink")).Run(func(args mock.Arguments) {
			link := args.Get(0).(*store.HackerLink)
			link.CreatedAt = time.Now()
			link.UpdatedAt = time.Now()
		}).Return(nil).Once()

		body := `{"label":"Updated","url":"https://example.com","icon":"link","display_order":2}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withHackerLinkRouteParam(req, "link-to-update")

		rr := executeRequest(req, http.HandlerFunc(app.updateHackerLinkHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data store.HackerLink `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "Updated", respBody.Data.Label)

		mockLinks.AssertExpectations(t)
	})

	t.Run("should return 404 if hacker link not found", func(t *testing.T) {
		mockLinks.On("Update", mock.AnythingOfType("*store.HackerLink")).Return(store.ErrNotFound).Once()

		body := `{"label":"Updated","url":"https://example.com","icon":"link","display_order":2}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withHackerLinkRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.updateHackerLinkHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockLinks.AssertExpectations(t)
	})
}

func TestDeleteHackerLink(t *testing.T) {
	app := newTestApplication(t)
	mockLinks := app.store.HackerLinks.(*store.MockHackerLinksStore)

	t.Run("should delete a hacker link", func(t *testing.T) {
		mockLinks.On("Delete", "link-to-delete").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withHackerLinkRouteParam(req, "link-to-delete")

		rr := executeRequest(req, http.HandlerFunc(app.deleteHackerLinkHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockLinks.AssertExpectations(t)
	})

	t.Run("should return 404 if hacker link not found", func(t *testing.T) {
		mockLinks.On("Delete", "nonexistent").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withHackerLinkRouteParam(req, "nonexistent")

		rr := executeRequest(req, http.HandlerFunc(app.deleteHackerLinkHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockLinks.AssertExpectations(t)
	})
}

func TestRequireRoleMiddleware_HackerLinks(t *testing.T) {
	t.Run("admin gets 403 on superadmin hacker link routes", func(t *testing.T) {
		app := newTestApplication(t)

		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			t.Error("handler should not be called")
		}))

		body := `{"label":"Discord","url":"https://discord.gg/hackutd","icon":"discord","display_order":1}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})
}
