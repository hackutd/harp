package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
)

// AdminUpdateApplicationPayload edits a hacker's application on their behalf.
// Responses are merged key by key into the stored answers, so a super admin
// only sends the answers they changed; a null value removes that answer.
type AdminUpdateApplicationPayload struct {
	Responses  json.RawMessage `json:"responses" swaggertype:"object"`
	ResumePath *string         `json:"resume_path"`
}

// loadApplicationForOverride resolves the {applicationID} URL param, writing
// the error response itself when it returns nil.
func (app *application) loadApplicationForOverride(w http.ResponseWriter, r *http.Request) *store.Application {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return nil
	}

	application, err := app.store.Application.GetByID(r.Context(), applicationID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return nil
		}
		app.internalServerError(w, r, err)
		return nil
	}

	return application
}

// writeAdminApplication responds with the application and the full schema,
// the same shape GET /admin/applications/{applicationID} returns.
func (app *application) writeAdminApplication(w http.ResponseWriter, r *http.Request, application *store.Application, schema []store.ApplicationSchemaField) {
	response := ApplicationWithSchema{
		Application:       application,
		ApplicationSchema: schema,
		Points:            app.userPoints(r, application.UserID),
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// adminUpdateApplicationHandler edits any application's answers or resume
//
//	@Summary		Update an application (Super Admin)
//	@Description	Edits a hacker's application answers and/or resume in any status. Responses are merged into the stored answers (null removes one) and type-checked against the schema; required answers are not enforced. resume_path must come from the super admin resume upload URL for this application.
//	@Tags			superadmin/applications
//	@Accept			json
//	@Produce		json
//	@Param			applicationID	path		string							true	"Application ID"
//	@Param			application		body		AdminUpdateApplicationPayload	true	"Fields to update"
//	@Success		200				{object}	ApplicationWithSchema
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID} [patch]
func (app *application) adminUpdateApplicationHandler(w http.ResponseWriter, r *http.Request) {
	application := app.loadApplicationForOverride(w, r)
	if application == nil {
		return
	}

	var req AdminUpdateApplicationPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if req.Responses != nil {
		var patch map[string]interface{}
		if err := json.Unmarshal(req.Responses, &patch); err != nil || patch == nil {
			app.badRequestResponse(w, r, errors.New("responses must be a JSON object"))
			return
		}

		// Only the edited answers are type-checked, so an answer left untouched
		// can't block a save after a schema change.
		if validationErrors := validateResponses(schema, patch, draftValidation); len(validationErrors) > 0 {
			app.validationErrorResponse(w, r, validationErrors)
			return
		}

		responses := make(map[string]interface{})
		if len(application.Responses) > 0 {
			if err := json.Unmarshal(application.Responses, &responses); err != nil || responses == nil {
				responses = make(map[string]interface{})
			}
		}
		for id, val := range patch {
			if val == nil {
				delete(responses, id)
			} else {
				responses[id] = val
			}
		}

		merged, err := json.Marshal(responses)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		application.Responses = merged
	}

	var replacedResume *string
	if req.ResumePath != nil {
		if !validResumeObjectPath(*req.ResumePath, application.UserID) {
			app.badRequestResponse(w, r, errors.New("invalid resume path"))
			return
		}
		if application.ResumePath != nil && *application.ResumePath != *req.ResumePath {
			replacedResume = application.ResumePath
		}
		application.ResumePath = req.ResumePath
	}

	if err := app.store.Application.Update(r.Context(), application); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	// The old file is unreachable once the row points at the new one.
	if replacedResume != nil {
		app.deleteResumeObject(r, application.ID, *replacedResume)
	}

	app.writeAdminApplication(w, r, application, schema)
}

// adminResumeUploadURLHandler returns a signed upload URL for replacing a hacker's resume
//
//	@Summary		Generate resume upload URL for an application (Super Admin)
//	@Description	Generates a signed GCS upload URL for a resume owned by the application's hacker. Upload the PDF, then PATCH the application with the returned resume_path.
//	@Tags			superadmin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ResumeUploadURLResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Failure		503				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/resume-upload-url [post]
func (app *application) adminResumeUploadURLHandler(w http.ResponseWriter, r *http.Request) {
	application := app.loadApplicationForOverride(w, r)
	if application == nil {
		return
	}

	if app.gcsClient == nil {
		app.requestLogger(r).Warnw("resume upload url requested but gcs is not configured", "application_id", application.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "resume uploads are not configured")
		return
	}

	app.writeResumeUploadURL(w, r, application.UserID)
}

// adminDeleteResumeHandler removes a hacker's resume
//
//	@Summary		Delete an application's resume (Super Admin)
//	@Description	Clears the resume on any application and best-effort deletes the file from GCS.
//	@Tags			superadmin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ApplicationWithSchema
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/resume [delete]
func (app *application) adminDeleteResumeHandler(w http.ResponseWriter, r *http.Request) {
	application := app.loadApplicationForOverride(w, r)
	if application == nil {
		return
	}

	if application.ResumePath == nil {
		app.notFoundResponse(w, r, errors.New("resume not found"))
		return
	}

	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	removed := *application.ResumePath
	application.ResumePath = nil
	if err := app.store.Application.Update(r.Context(), application); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.deleteResumeObject(r, application.ID, removed)

	app.writeAdminApplication(w, r, application, schema)
}

// deleteResumeObject best-effort deletes a resume file no row points at any
// more. An orphaned object is cheap, so a failure is only logged.
func (app *application) deleteResumeObject(r *http.Request, applicationID, objectPath string) {
	if app.gcsClient == nil {
		app.requestLogger(r).Warnw("resume delete skipped because gcs is not configured", "application_id", applicationID, "resume_path", objectPath)
		return
	}
	if err := app.gcsClient.DeleteObject(r.Context(), objectPath); err != nil {
		app.requestLogger(r).Warnw("failed to delete resume from gcs", "application_id", applicationID, "resume_path", objectPath, "error", err)
	}
}
