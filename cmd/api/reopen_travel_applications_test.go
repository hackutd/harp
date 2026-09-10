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

func TestReopenTravelApplications(t *testing.T) {
	t.Run("should allow super admin to reopen travel applications by status", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenTravelPayload{
			Statuses: []store.TravelStatus{store.TravelApproved, store.TravelRejected},
		}

		// Mock successful reopen
		app.store.Application.(*store.MockApplicationStore).
			On("ReopenTravelByStatus", payload.Statuses).
			Return(int64(42), nil)

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))

		assert.Equal(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ReopenTravelResponse `json:"data"`
		}
		err := json.Unmarshal(rr.Body.Bytes(), &respBody)
		assert.NoError(t, err)
		assert.Equal(t, payload.Statuses, respBody.Data.Statuses)
		assert.Equal(t, int64(42), respBody.Data.Updated)

		app.store.Application.(*store.MockApplicationStore).AssertExpectations(t)
	})

	t.Run("should return 400 for empty or invalid status array", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenTravelPayload{
			Statuses: []store.TravelStatus{},
		}
		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)

		payload = ReopenTravelPayload{
			Statuses: []store.TravelStatus{"invalid"},
		}
		reqBody, _ = json.Marshal(payload)
		req, _ = http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr = executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 if trying to reopen pending or not requested", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenTravelPayload{
			Statuses: []store.TravelStatus{store.TravelPending},
		}
		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)

		payload = ReopenTravelPayload{
			Statuses: []store.TravelStatus{store.TravelNotRequested},
		}
		reqBody, _ = json.Marshal(payload)
		req, _ = http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr = executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 500 when store fails", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ReopenTravelPayload{
			Statuses: []store.TravelStatus{store.TravelApproved},
		}

		app.store.Application.(*store.MockApplicationStore).
			On("ReopenTravelByStatus", payload.Statuses).
			Return(int64(0), errors.New("database error"))

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.reopenTravelApplicationsHandler))
		assert.Equal(t, http.StatusInternalServerError, rr.Code)

		app.store.Application.(*store.MockApplicationStore).AssertExpectations(t)
	})

	t.Run("should forbid non-super-admin users", func(t *testing.T) {
		app := newTestApplication(t)
		payload := ReopenTravelPayload{
			Statuses: []store.TravelStatus{store.TravelApproved},
		}
		reqBody, _ := json.Marshal(payload)

		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/applications/travel/reopen", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newAdminUser())

		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(http.HandlerFunc(app.reopenTravelApplicationsHandler))
		rr := executeRequest(req, handler)
		assert.Equal(t, http.StatusForbidden, rr.Code)
	})
}
