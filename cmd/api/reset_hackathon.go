package main

import (
	"context"
	"errors"
	"net/http"
)

type ResetHackathonPayload struct {
	ResetApplications bool `json:"reset_applications"`
	ResetScans        bool `json:"reset_scans"`
	ResetSchedule     bool `json:"reset_schedule"`
	ResetSettings     bool `json:"reset_settings"`
}

type ResetHackathonResponse struct {
	Success           bool `json:"success"`
	ResetApplications bool `json:"reset_applications"`
	ResetScans        bool `json:"reset_scans"`
	ResetSchedule     bool `json:"reset_schedule"`
	ResetSettings     bool `json:"reset_settings"`
	ResumesDeleted    int  `json:"resumes_deleted"`
}

// resetHackathonHandler resets hackathon data based on options
//
//	@Summary		Reset hackathon data (Super Admin)
//	@Description	Resets selected hackathon data (applications, scans, schedule, settings). Operations are performed in a single transaction.
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			options	body		ResetHackathonPayload	true	"Reset options"
//	@Success		200		{object}	ResetHackathonResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/reset-hackathon [post]
func (app *application) resetHackathonHandler(w http.ResponseWriter, r *http.Request) {
	var req ResetHackathonPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if !req.ResetApplications && !req.ResetScans && !req.ResetSchedule && !req.ResetSettings {
		app.badRequestResponse(w, r, errors.New("at least one reset option must be selected"))
		return
	}

	user := getUserFromContext(r.Context())
	if user == nil {
		app.internalServerError(w, r, errors.New("user not in context"))
		return
	}

	resumePaths, err := app.store.Hackathon.Reset(r.Context(), req.ResetApplications, req.ResetScans, req.ResetSchedule, req.ResetSettings)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Best-effort cleanup of resumes from GCS
	if len(resumePaths) > 0 && app.gcsClient != nil {
		go func(paths []string) {
			for _, path := range paths {
				_ = app.gcsClient.DeleteObject(context.Background(), path)
			}
		}(resumePaths)
	}

	app.logger.Infow("hackathon data reset", "user_id", user.ID, "user_email", user.Email, "reset_apps", req.ResetApplications, "reset_scans", req.ResetScans, "reset_schedule", req.ResetSchedule, "reset_settings", req.ResetSettings, "resumes_deleted_count", len(resumePaths))

	response := ResetHackathonResponse{
		Success:           true,
		ResetApplications: req.ResetApplications,
		ResetScans:        req.ResetScans,
		ResetSchedule:     req.ResetSchedule,
		ResetSettings:     req.ResetSettings,
		ResumesDeleted:    len(resumePaths),
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
