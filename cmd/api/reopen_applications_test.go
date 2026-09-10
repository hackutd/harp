package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestReopenApplications(t *testing.T) {
	t.Run("should allow super admin to reopen applications by status", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{store.StatusSubmitted, store.StatusRejected},
		}

		// Mock successful reopen
		app.store.Application.(*store.MockApplicationStore).
			On("ReopenByStatus", payload.Statuses).
			Return(int64(42), nil)

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenApplicationsHandler))

		assert.Equal(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ReopenApplicationsResponse `json:"data"`
		}
		err := json.Unmarshal(rr.Body.Bytes(), &respBody)
		assert.NoError(t, err)
		assert.Equal(t, payload.Statuses, respBody.Data.Statuses)
		assert.Equal(t, int64(42), respBody.Data.Updated)

		app.store.Application.(*store.MockApplicationStore).AssertExpectations(t)
	})

	t.Run("should return 400 for empty or invalid status array", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{},
		}
		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)

		payload = ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{"invalid"},
		}
		reqBody, _ = json.Marshal(payload)
		req, _ = http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr = executeRequest(req, http.HandlerFunc(app.reopenApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 if trying to reopen drafts", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{store.StatusDraft},
		}
		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 500 when store fails", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{store.StatusSubmitted},
		}

		app.store.Application.(*store.MockApplicationStore).
			On("ReopenByStatus", payload.Statuses).
			Return(int64(0), errors.New("database error"))

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenApplicationsHandler))
		assert.Equal(t, http.StatusInternalServerError, rr.Code)

		app.store.Application.(*store.MockApplicationStore).AssertExpectations(t)
	})

	t.Run("should forbid non-super-admin users", func(t *testing.T) {
		app := newTestApplication(t)
		payload := ReopenApplicationsPayload{
			Statuses: []store.ApplicationStatus{store.StatusSubmitted},
		}
		reqBody, _ := json.Marshal(payload)

		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newAdminUser()) // Admin is not SuperAdmin

		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(http.HandlerFunc(app.reopenApplicationsHandler))
		rr := executeRequest(req, handler)
		assert.Equal(t, http.StatusForbidden, rr.Code)
	})
}
