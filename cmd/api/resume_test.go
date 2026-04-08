package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/gcs"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGenerateResumeUploadURL(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should generate upload url", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockGCS.On(
			"GenerateUploadURL",
			mock.Anything,
			mock.MatchedBy(func(path string) bool {
				return strings.HasPrefix(path, "resumes/"+user.ID+"/") && strings.HasSuffix(path, ".pdf")
			}),
		).Return("https://upload.example.com", nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.generateResumeUploadURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ResumeUploadURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, "https://upload.example.com", body.Data.UploadURL)
		assert.True(t, strings.HasPrefix(body.Data.ResumePath, "resumes/"+user.ID+"/"))
		assert.True(t, strings.HasSuffix(body.Data.ResumePath, ".pdf"))

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when application is not found", func(t *testing.T) {
		user := newTestUser()
		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.generateResumeUploadURLHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when application is already submitted", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted}
		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.generateResumeUploadURLHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 503 when gcs is not configured", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		app.gcsClient = nil

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.generateResumeUploadURLHandler))
		checkResponseCode(t, http.StatusServiceUnavailable, rr.Code)

		app.gcsClient = mockGCS
		mockApps.AssertExpectations(t)
	})

	t.Run("should return 500 when gcs signing fails", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockGCS.On("GenerateUploadURL", mock.Anything, mock.AnythingOfType("string")).Return("", errors.New("gcs failed")).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.generateResumeUploadURLHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})
}

func TestDeleteResume(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should delete resume", func(t *testing.T) {
		user := newTestUser()
		resumePath := "resumes/user-1/file.pdf"
		application := &store.Application{
			ID:         "app-1",
			UserID:     user.ID,
			Status:     store.StatusDraft,
			ResumePath: &resumePath,
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, resumePath).Return(nil).Once()
		mockApps.On("Update", mock.AnythingOfType("*store.Application")).Run(func(args mock.Arguments) {
			updated := args.Get(0).(*store.Application)
			assert.Nil(t, updated.ResumePath)
		}).Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.deleteResumeHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when no resume exists", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.deleteResumeHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when application is already submitted", func(t *testing.T) {
		user := newTestUser()
		resumePath := "resumes/user-1/file.pdf"
		application := &store.Application{
			ID:         "app-1",
			UserID:     user.ID,
			Status:     store.StatusSubmitted,
			ResumePath: &resumePath,
		}
		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.deleteResumeHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestGetResumeDownloadURL(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	withRouteParam := func(req *http.Request, applicationID string) *http.Request {
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", applicationID)
		return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	}

	t.Run("should generate download url", func(t *testing.T) {
		resumePath := "resumes/user-1/file.pdf"
		application := &store.Application{ID: "app-1", ResumePath: &resumePath}
		mockApps.On("GetByID", "app-1").Return(application, nil).Once()
		mockGCS.On("GenerateDownloadURL", mock.Anything, resumePath).Return("https://download.example.com", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		req = withRouteParam(req, "app-1")

		rr := executeRequest(req, http.HandlerFunc(app.getResumeDownloadURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ResumeDownloadURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, "https://download.example.com", body.Data.DownloadURL)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when application is not found", func(t *testing.T) {
		mockApps.On("GetByID", "missing").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		req = withRouteParam(req, "missing")

		rr := executeRequest(req, http.HandlerFunc(app.getResumeDownloadURLHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when resume does not exist", func(t *testing.T) {
		application := &store.Application{ID: "app-1", ResumePath: nil}
		mockApps.On("GetByID", "app-1").Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		req = withRouteParam(req, "app-1")

		rr := executeRequest(req, http.HandlerFunc(app.getResumeDownloadURLHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}
