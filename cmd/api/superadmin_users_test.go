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
	"github.com/stretchr/testify/require"
)

func TestSearchUsers(t *testing.T) {
	app := newTestApplication(t)
	mockUsers := app.store.Users.(*store.MockUsersStore)

	t.Run("should return matching users", func(t *testing.T) {
		firstName := "John"
		result := &store.UserSearchResult{
			Users: []store.UserListItem{
				{
					ID:        "user-1",
					Email:     "john@utdallas.edu",
					Role:      store.RoleHacker,
					FirstName: &firstName,
					CreatedAt: time.Now(),
				},
			},
			TotalCount: 1,
		}

		mockUsers.On("Search", "john", 20, 0).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?search=john", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.searchUsersHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data store.UserSearchResult `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 1, body.Data.TotalCount)
		assert.Equal(t, "john@utdallas.edu", body.Data.Users[0].Email)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 400 when search is missing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.searchUsersHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when search is too short", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?search=a", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.searchUsersHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should accept custom limit and offset", func(t *testing.T) {
		result := &store.UserSearchResult{
			Users:      []store.UserListItem{},
			TotalCount: 0,
		}

		mockUsers.On("Search", "test", 10, 5).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?search=test&limit=10&offset=5", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.searchUsersHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockUsers.AssertExpectations(t)
	})
}

func TestUpdateUserRole(t *testing.T) {
	app := newTestApplication(t)
	mockUsers := app.store.Users.(*store.MockUsersStore)

	t.Run("should update role to admin", func(t *testing.T) {
		returned := &store.User{
			ID:    "user-1",
			Email: "hacker@test.com",
			Role:  store.RoleAdmin,
		}
		mockUsers.On("UpdateRole", "user-1", store.RoleAdmin).Return(returned, nil).Once()

		body := `{"role":"admin"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("userID", "user-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.updateUserRoleHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data UpdateRoleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, store.RoleAdmin, resp.Data.User.Role)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 404 when user not found", func(t *testing.T) {
		mockUsers.On("UpdateRole", "nonexistent", store.RoleAdmin).Return(nil, store.ErrNotFound).Once()

		body := `{"role":"admin"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("userID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.updateUserRoleHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid role", func(t *testing.T) {
		body := `{"role":"overlord"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("userID", "user-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.updateUserRoleHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when role is missing", func(t *testing.T) {
		body := `{}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("userID", "user-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.updateUserRoleHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}
