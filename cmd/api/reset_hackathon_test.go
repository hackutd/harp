package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
)

func TestResetHackathon(t *testing.T) {
	t.Run("should allow super admin to reset data", func(t *testing.T) {
		app := newTestApplication(t)
		app.gcsClient = nil // Ensure GCS client is nil to skip file deletion logic

		payload := ResetHackathonPayload{
			ResetApplications: true,
			ResetScans:        true,
			ResetSchedule:     true,
			ResetSettings:     true,
		}

		// Mock successful reset
		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", true, true, true, true).
			Return([]string{"resume1.pdf", "resume2.pdf"}, nil)

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ResetHackathonResponse `json:"data"`
		}
		err := json.Unmarshal(rr.Body.Bytes(), &respBody)
		assert.NoError(t, err)
		assert.Equal(t, 2, respBody.Data.ResumesDeleted)

		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should return 500 when transaction fails", func(t *testing.T) {
		app := newTestApplication(t)
		app.gcsClient = nil

		payload := ResetHackathonPayload{
			ResetApplications: true,
		}

		// Simulate partial failure/rollback by returning error from store
		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", true, false, false, false).
			Return([]string(nil), errors.New("db transaction failed"))

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusInternalServerError, rr.Code)

		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should forbid non-super-admin users", func(t *testing.T) {
		app := newTestApplication(t)
		payload := ResetHackathonPayload{ResetApplications: true}
		reqBody, _ := json.Marshal(payload)

		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newAdminUser()) // Admin is not SuperAdmin

		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(http.HandlerFunc(app.resetHackathonHandler))
		rr := executeRequest(req, handler)
		assert.Equal(t, http.StatusForbidden, rr.Code)
	})
}
