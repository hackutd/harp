package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

const randomResumeObjectIDBytes = 16

type ResumeUploadURLResponse struct {
	UploadURL  string `json:"upload_url"`
	ResumePath string `json:"resume_path"`
}

type ResumeDownloadURLResponse struct {
	DownloadURL string `json:"download_url"`
}

// generateResumeUploadURLHandler returns a signed upload URL for hacker resume uploads.
//
// @Summary		Generate resume upload URL
// @Description	Generates a signed GCS upload URL for the authenticated user's resume. Application must be in draft status.
// @Tags			hackers
// @Produce		json
// @Success		200	{object}	ResumeUploadURLResponse
// @Failure		401	{object}	object{error=string}
// @Failure		404	{object}	object{error=string}
// @Failure		409	{object}	object{error=string}
// @Failure		500	{object}	object{error=string}
// @Failure		503	{object}	object{error=string}
// @Security		CookieAuth
// @Router			/applications/me/resume-upload-url [post]
func (app *application) generateResumeUploadURLHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("missing user in context"))
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if application.Status != store.StatusDraft {
		app.conflictResponse(w, r, errors.New("cannot update submitted application"))
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("resume upload url requested but gcs is not configured", "user_id", user.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "resume uploads are not configured")
		return
	}

	randomID, err := randomHex(randomResumeObjectIDBytes)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	objectPath := fmt.Sprintf("resumes/%s/%s.pdf", user.ID, randomID)

	uploadURL, err := app.gcsClient.GenerateUploadURL(r.Context(), objectPath)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ResumeUploadURLResponse{
		UploadURL:  uploadURL,
		ResumePath: objectPath,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteResumeHandler removes the resume path from the draft application and best-effort deletes from GCS.
//
// @Summary		Delete resume
// @Description	Deletes the resume reference from the authenticated user's draft application and best-effort deletes the object from GCS.
// @Tags			hackers
// @Produce		json
// @Success		200	{object}	store.Application
// @Failure		401	{object}	object{error=string}
// @Failure		404	{object}	object{error=string}
// @Failure		409	{object}	object{error=string}
// @Failure		500	{object}	object{error=string}
// @Security		CookieAuth
// @Router			/applications/me/resume [delete]
func (app *application) deleteResumeHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("missing user in context"))
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if application.Status != store.StatusDraft {
		app.conflictResponse(w, r, errors.New("cannot update submitted application"))
		return
	}

	if application.ResumePath == nil {
		app.notFoundResponse(w, r, errors.New("resume not found"))
		return
	}

	if app.gcsClient != nil {
		if err := app.gcsClient.DeleteObject(r.Context(), *application.ResumePath); err != nil {
			app.logger.Warnw("failed to delete resume from gcs", "application_id", application.ID, "resume_path", *application.ResumePath, "error", err)
		}
	} else {
		app.logger.Warnw("resume delete requested but gcs is not configured", "application_id", application.ID, "resume_path", *application.ResumePath)
	}

	application.ResumePath = nil
	if err := app.store.Application.Update(r.Context(), application); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getResumeDownloadURLHandler returns a signed download URL for admin viewing.
//
// @Summary		Get resume download URL (Admin)
// @Description	Generates a signed GCS download URL for an application's resume.
// @Tags			admin/applications
// @Produce		json
// @Param			applicationID	path		string	true	"Application ID"
// @Success		200				{object}	ResumeDownloadURLResponse
// @Failure		400				{object}	object{error=string}
// @Failure		401				{object}	object{error=string}
// @Failure		403				{object}	object{error=string}
// @Failure		404				{object}	object{error=string}
// @Failure		500				{object}	object{error=string}
// @Failure		503				{object}	object{error=string}
// @Security		CookieAuth
// @Router			/admin/applications/{applicationID}/resume-url [get]
func (app *application) getResumeDownloadURLHandler(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	application, err := app.store.Application.GetByID(r.Context(), applicationID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if application.ResumePath == nil {
		app.notFoundResponse(w, r, errors.New("resume not found"))
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("resume download url requested but gcs is not configured", "application_id", application.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "resume downloads are not configured")
		return
	}

	downloadURL, err := app.gcsClient.GenerateDownloadURL(r.Context(), *application.ResumePath)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ResumeDownloadURLResponse{
		DownloadURL: downloadURL,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(buf), nil
}
