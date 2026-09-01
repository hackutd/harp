package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestResetHackathon(t *testing.T) {
	t.Run("should allow super admin to reset data", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		payload := ResetHackathonPayload{
			ResetApplications:  true,
			ResetScans:         true,
			ResetScanTypes:     true,
			ResetSchedule:      true,
			ResetSettings:      true,
			ResetNotifications: true,
			ResetSponsors:      true,
			ResetFAQs:          true,
			ResetConfig:        true,
		}

		// Mock successful reset
		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", store.ResetOptions{
				Applications: true, Scans: true, ScanTypes: true, Schedule: true,
				Notifications: true, Settings: true, Sponsors: true, FAQs: true,
				Config: true,
			}).
			Return(&store.ResetPaths{
				Resumes:        []string{"resumes/user-1/resume1.pdf", "resumes/user-2/resume2.pdf"},
				TravelReceipts: []string{validTestReceiptPath("user-1")},
			}, nil)

		// Upload cleanup runs in the background; wait for all deletes.
		var deletions sync.WaitGroup
		mockGCS.On("ListObjects", mock.Anything, hackathonStorageRootPrefix).
			Return([]string{
				"hackathons/hackutd-2026/resumes/orphan.pdf",
				validTestReceiptPath("user-2"),
				"hackathons/hackutd-2026/assets/logo.png",
			}, nil).
			Once()
		mockGCS.On("ListObjects", mock.Anything, legacyResumeStoragePrefix).
			Return([]string{"resumes/legacy-orphan.pdf"}, nil).
			Once()

		deletions.Add(6)
		for _, path := range []string{
			"resumes/user-1/resume1.pdf",
			"resumes/user-2/resume2.pdf",
			"hackathons/hackutd-2026/resumes/orphan.pdf",
			"resumes/legacy-orphan.pdf",
			// Receipts are cleaned up alongside resumes: both the ones the
			// applications pointed at and any orphan left in the bucket.
			validTestReceiptPath("user-1"),
			validTestReceiptPath("user-2"),
		} {
			mockGCS.On("DeleteObject", mock.Anything, path).
				Return(nil).
				Once().
				Run(func(mock.Arguments) { deletions.Done() })
		}

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
		assert.Equal(t, 1, respBody.Data.ReceiptsDeleted)

		deletions.Wait()
		mockGCS.AssertExpectations(t)
		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should not claim resume deletions when storage is unavailable", func(t *testing.T) {
		app := newTestApplication(t)
		app.gcsClient = nil

		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", store.ResetOptions{Applications: true}).
			Return(&store.ResetPaths{Resumes: []string{"resume1.pdf", "resume2.pdf"}}, nil)

		reqBody, _ := json.Marshal(ResetHackathonPayload{ResetApplications: true})
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ResetHackathonResponse `json:"data"`
		}
		err := json.Unmarshal(rr.Body.Bytes(), &respBody)
		assert.NoError(t, err)
		assert.Equal(t, 0, respBody.Data.ResumesDeleted)

		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should clean orphaned objects from the current hackathon prefix", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		orphanPath := "hackathons/hackutd-2026/resumes/user-1/orphan.pdf"

		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", store.ResetOptions{Applications: true}).
			Return(&store.ResetPaths{}, nil).
			Once()
		mockGCS.On("ListObjects", mock.Anything, hackathonStorageRootPrefix).
			Return([]string{orphanPath, "hackathons/hackutd-2026/assets/logo.png"}, nil).
			Once()
		mockGCS.On("ListObjects", mock.Anything, legacyResumeStoragePrefix).
			Return([]string(nil), nil).
			Once()

		var deletion sync.WaitGroup
		deletion.Add(1)
		mockGCS.On("DeleteObject", mock.Anything, orphanPath).
			Return(nil).
			Once().
			Run(func(mock.Arguments) { deletion.Done() })

		reqBody, _ := json.Marshal(ResetHackathonPayload{ResetApplications: true})
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusOK, rr.Code)
		deletion.Wait()
		mockGCS.AssertExpectations(t)
		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should reset content-only domains without touching applications", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ResetHackathonPayload{
			ResetScanTypes: true,
			ResetSponsors:  true,
			ResetFAQs:      true,
		}

		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", store.ResetOptions{ScanTypes: true, Sponsors: true, FAQs: true}).
			Return(&store.ResetPaths{}, nil)

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
		assert.True(t, respBody.Data.ResetScanTypes)
		assert.True(t, respBody.Data.ResetSponsors)
		assert.True(t, respBody.Data.ResetFAQs)
		assert.False(t, respBody.Data.ResetApplications)
		assert.Equal(t, 0, respBody.Data.ResumesDeleted)

		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should reset per-cycle config on its own", func(t *testing.T) {
		app := newTestApplication(t)

		app.store.Hackathon.(*store.MockHackathonStore).
			On("Reset", store.ResetOptions{Config: true}).
			Return(&store.ResetPaths{}, nil)

		reqBody, _ := json.Marshal(ResetHackathonPayload{ResetConfig: true})
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ResetHackathonResponse `json:"data"`
		}
		err := json.Unmarshal(rr.Body.Bytes(), &respBody)
		assert.NoError(t, err)
		assert.True(t, respBody.Data.ResetConfig)
		assert.False(t, respBody.Data.ResetSettings)

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
			On("Reset", store.ResetOptions{Applications: true}).
			Return(nil, errors.New("db transaction failed"))

		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))

		assert.Equal(t, http.StatusInternalServerError, rr.Code)

		app.store.Hackathon.(*store.MockHackathonStore).AssertExpectations(t)
	})

	t.Run("should return 400 for invalid JSON body", func(t *testing.T) {
		app := newTestApplication(t)

		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBufferString("{invalid json"))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 when no options selected", func(t *testing.T) {
		app := newTestApplication(t)

		payload := ResetHackathonPayload{}
		reqBody, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/v1/superadmin/reset-hackathon", bytes.NewBuffer(reqBody))
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.resetHackathonHandler))
		assert.Equal(t, http.StatusBadRequest, rr.Code)
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
