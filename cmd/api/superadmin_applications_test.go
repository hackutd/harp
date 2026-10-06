package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const (
	overrideOldResume = "hackathons/hackutd-2026/resumes/user-1/0123456789abcdef0123456789abcdef.pdf"
	overrideNewResume = "hackathons/hackutd-2026/resumes/user-1/fedcba9876543210fedcba9876543210.pdf"
)

func newOverrideRequest(t *testing.T, method, applicationID, body string) *http.Request {
	t.Helper()
	var req *http.Request
	var err error
	if body == "" {
		req, err = http.NewRequest(method, "/", nil)
	} else {
		req, err = http.NewRequest(method, "/", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	require.NoError(t, err)
	req = setUserContext(req, newSuperAdminUser())
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("applicationID", applicationID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func overrideSchema() []store.ApplicationSchemaField {
	return []store.ApplicationSchemaField{
		{ID: "first_name", Type: "text", Label: "First Name", Required: true},
		{ID: "age", Type: "number", Label: "Age", Required: true},
		{ID: "shirt_size", Type: "select", Label: "Shirt", Options: []string{"S", "M", "L"}},
	}
}

func decodeOverrideApplication(t *testing.T, body []byte) store.Application {
	t.Helper()
	var envelope struct {
		Data store.Application `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &envelope))
	return envelope.Data
}

func TestSetApplicationStatusAnyStatus(t *testing.T) {
	for _, status := range []store.ApplicationStatus{store.StatusDraft, store.StatusSubmitted} {
		t.Run(string(status), func(t *testing.T) {
			app := newTestApplication(t)
			mockApps := app.store.Application.(*store.MockApplicationStore)
			mockApps.On("SetStatus", "app-1", status).
				Return(&store.Application{ID: "app-1", Status: status}, nil).Once()

			req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"status":"`+string(status)+`"}`)
			rr := executeRequest(req, http.HandlerFunc(app.setApplicationStatus))
			checkResponseCode(t, http.StatusOK, rr.Code)

			mockApps.AssertExpectations(t)
		})
	}
}

func TestAdminUpdateApplication(t *testing.T) {
	t.Run("merges edited answers in any status", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		existing := newCompleteApplication("user-1")
		existing.Status = store.StatusAccepted
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()
		mockApps.On("Update", mock.MatchedBy(func(a *store.Application) bool {
			var got map[string]interface{}
			if err := json.Unmarshal(a.Responses, &got); err != nil {
				return false
			}
			_, hasShirt := got["shirt_size"]
			return got["first_name"] == "Jane" && got["last_name"] == "Doe" && !hasShirt
		})).Return(nil).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").Return(0, nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"responses":{"first_name":"Jane","shirt_size":null}}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		got := decodeOverrideApplication(t, rr.Body.Bytes())
		assert.Equal(t, store.StatusAccepted, got.Status)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("does not enforce required answers", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()
		mockApps.On("Update", mock.AnythingOfType("*store.Application")).Return(nil).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").Return(0, nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"responses":{"first_name":null}}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("rejects a wrongly typed answer", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"responses":{"age":"twenty"}}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertNotCalled(t, "Update", mock.Anything)
	})

	t.Run("rejects responses that are not an object", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"responses":["nope"]}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertNotCalled(t, "Update", mock.Anything)
	})

	t.Run("replaces the resume and deletes the old file", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		existing := newCompleteApplication("user-1")
		existing.Status = store.StatusSubmitted
		oldPath := overrideOldResume
		existing.ResumePath = &oldPath
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()
		mockApps.On("Update", mock.MatchedBy(func(a *store.Application) bool {
			return a.ResumePath != nil && *a.ResumePath == overrideNewResume
		})).Return(nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, overrideOldResume).Return(nil).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").Return(0, nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"resume_path":"`+overrideNewResume+`"}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("rejects a resume path owned by another user", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-2"), nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"resume_path":"`+overrideNewResume+`"}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertNotCalled(t, "Update", mock.Anything)
	})

	t.Run("returns 404 when application not found", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockApps.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		req := newOverrideRequest(t, http.MethodPatch, "missing", `{"responses":{}}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	t.Run("returns 500 when the update fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()
		mockApps.On("Update", mock.Anything).Return(errors.New("db down")).Once()

		req := newOverrideRequest(t, http.MethodPatch, "app-1", `{"responses":{"first_name":"Jane"}}`)
		rr := executeRequest(req, http.HandlerFunc(app.adminUpdateApplicationHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestAdminResumeUploadURL(t *testing.T) {
	t.Run("issues a path owned by the application's hacker", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		existing := newCompleteApplication("user-1")
		existing.Status = store.StatusAccepted
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()
		mockGCS.On("GenerateUploadURL", mock.Anything, mock.MatchedBy(func(path string) bool {
			return validResumeObjectPath(path, "user-1")
		})).Return("https://upload.example.com", nil).Once()

		req := newOverrideRequest(t, http.MethodPost, "app-1", "")
		rr := executeRequest(req, http.HandlerFunc(app.adminResumeUploadURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockGCS.AssertExpectations(t)
	})

	t.Run("returns 503 when gcs is not configured", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()
		app.gcsClient = nil

		req := newOverrideRequest(t, http.MethodPost, "app-1", "")
		rr := executeRequest(req, http.HandlerFunc(app.adminResumeUploadURLHandler))
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)
	})

	t.Run("returns 404 when application not found", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockApps.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		req := newOverrideRequest(t, http.MethodPost, "missing", "")
		rr := executeRequest(req, http.HandlerFunc(app.adminResumeUploadURLHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})
}

func TestAdminDeleteResume(t *testing.T) {
	t.Run("clears the resume in any status", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		existing := newCompleteApplication("user-1")
		existing.Status = store.StatusAccepted
		oldPath := overrideOldResume
		existing.ResumePath = &oldPath
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(overrideSchema(), nil).Once()
		mockApps.On("Update", mock.MatchedBy(func(a *store.Application) bool {
			return a.ResumePath == nil
		})).Return(nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, overrideOldResume).Return(errors.New("gcs down")).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").Return(0, nil).Once()

		req := newOverrideRequest(t, http.MethodDelete, "app-1", "")
		rr := executeRequest(req, http.HandlerFunc(app.adminDeleteResumeHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		assert.Nil(t, decodeOverrideApplication(t, rr.Body.Bytes()).ResumePath)
		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("returns 404 when there is no resume", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockApps.On("GetByID", "app-1").Return(newCompleteApplication("user-1"), nil).Once()

		req := newOverrideRequest(t, http.MethodDelete, "app-1", "")
		rr := executeRequest(req, http.HandlerFunc(app.adminDeleteResumeHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})
}
