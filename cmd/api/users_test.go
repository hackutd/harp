package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testUUID1       = "11111111-1111-1111-1111-111111111111"
	testUUID2       = "22222222-2222-2222-2222-222222222222"
	superAdminUUID  = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	nonexistentUUID = "99999999-9999-9999-9999-999999999999"
)

func newSuperAdminUserWithUUID() *store.User {
	return &store.User{
		ID:                superAdminUUID,
		SuperTokensUserID: "st-superadmin-uuid",
		Email:             "superadmin@test.com",
		Role:              store.RoleSuperAdmin,
		AuthMethod:        store.AuthMethodPasswordless,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

func TestBatchUpdateRoles(t *testing.T) {
	app := newTestApplication(t)
	mockUsers := app.store.Users.(*store.MockUsersStore)

	superAdmin := newSuperAdminUserWithUUID()

	t.Run("should update roles successfully", func(t *testing.T) {
		updated := []*store.User{
			{ID: testUUID1, Email: "a@test.com", Role: store.RoleAdmin, CreatedAt: time.Now(), UpdatedAt: time.Now()},
			{ID: testUUID2, Email: "b@test.com", Role: store.RoleAdmin, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		}
		mockUsers.On("BatchUpdateRoles", []string{testUUID1, testUUID2}, store.RoleAdmin).Return(updated, nil).Once()

		body := `{"user_ids":["` + testUUID1 + `","` + testUUID2 + `"],"role":"admin"}`
		req, err := http.NewRequest(http.MethodPatch, "/v1/superadmin/users/role", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, superAdmin)

		rr := executeRequest(req, http.HandlerFunc(app.batchUpdateRolesHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data BatchUpdateRolesResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Len(t, resp.Data.Users, 2)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 400 when role is super_admin", func(t *testing.T) {
		body := `{"user_ids":["` + testUUID1 + `"],"role":"super_admin"}`
		req, err := http.NewRequest(http.MethodPatch, "/v1/superadmin/users/role", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, superAdmin)

		rr := executeRequest(req, http.HandlerFunc(app.batchUpdateRolesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when user_ids is empty", func(t *testing.T) {
		body := `{"user_ids":[],"role":"admin"}`
		req, err := http.NewRequest(http.MethodPatch, "/v1/superadmin/users/role", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, superAdmin)

		rr := executeRequest(req, http.HandlerFunc(app.batchUpdateRolesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when caller tries to modify own role", func(t *testing.T) {
		body := `{"user_ids":["` + superAdminUUID + `","` + testUUID2 + `"],"role":"hacker"}`
		req, err := http.NewRequest(http.MethodPatch, "/v1/superadmin/users/role", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, superAdmin)

		rr := executeRequest(req, http.HandlerFunc(app.batchUpdateRolesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&errBody)
		require.NoError(t, err)
		assert.Contains(t, errBody.Error, "own role")
	})

	t.Run("should return 400 when a user ID does not exist", func(t *testing.T) {
		// Store returns fewer users than requested (one ID didn't match)
		updated := []*store.User{
			{ID: testUUID1, Email: "a@test.com", Role: store.RoleHacker, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		}
		mockUsers.On("BatchUpdateRoles", []string{testUUID1, nonexistentUUID}, store.RoleHacker).Return(updated, nil).Once()

		body := `{"user_ids":["` + testUUID1 + `","` + nonexistentUUID + `"],"role":"hacker"}`
		req, err := http.NewRequest(http.MethodPatch, "/v1/superadmin/users/role", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, superAdmin)

		rr := executeRequest(req, http.HandlerFunc(app.batchUpdateRolesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockUsers.AssertExpectations(t)
	})
}
