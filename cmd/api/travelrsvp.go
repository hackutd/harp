package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/slug"
	"github.com/hackutd/harp/internal/store"
)

// travelReceiptDeleteTimeout bounds the cleanup of receipts detached by an RSVP
// reset. An application carries at most 5 of them, so the cleanup runs inline
// and the admin sees the reset finish once storage has caught up.
const travelReceiptDeleteTimeout = 30 * time.Second

// travelReceiptContentTypes maps allowed receipt upload content types to the
// file extension used in the GCS object path.
var travelReceiptContentTypes = map[string]string{
	"application/pdf": "pdf",
	"image/png":       "png",
	"image/jpeg":      "jpg",
}

// TravelRSVPResponse is the hacker-facing view of their travel RSVP state plus
// the configurable form schema needed to render the travel RSVP form.
type TravelRSVPResponse struct {
	TravelRSVPStatus      store.RSVPStatus               `json:"travel_rsvp_status"`
	TravelRSVPResponses   json.RawMessage                `json:"travel_rsvp_responses" swaggertype:"object"`
	TravelRSVPSubmittedAt *time.Time                     `json:"travel_rsvp_submitted_at"`
	TravelReceiptPaths    []string                       `json:"travel_receipt_paths"`
	TravelRSVPSchema      []store.ApplicationSchemaField `json:"travel_rsvp_schema"`
	TravelRSVPEnabled     bool                           `json:"travel_rsvp_enabled"`
	// TravelApprovedAmountCents is the reimbursement amount the organizers
	// committed to, shown to the hacker on the travel form. It is decided by a
	// super admin and is never editable by the hacker.
	TravelApprovedAmountCents *int64 `json:"travel_approved_amount_cents"`
	// ReceiptRequiredFieldID and ReceiptRequiredValue tell the client which
	// answer makes a receipt upload mandatory, so the rule lives in one place.
	ReceiptRequiredFieldID string `json:"receipt_required_field_id"`
	ReceiptRequiredValue   string `json:"receipt_required_value"`
}

type SubmitTravelRSVPPayload struct {
	Status    store.RSVPStatus `json:"status" validate:"required,oneof=confirmed declined"`
	Responses json.RawMessage  `json:"responses" swaggertype:"object"`
	// ReceiptPaths holds up to 5 uploaded receipt object paths.
	ReceiptPaths []string `json:"receipt_paths" validate:"omitempty,max=5,dive,max=512"`
}

type TravelReceiptUploadURLPayload struct {
	ContentType string `json:"content_type" validate:"required,oneof=application/pdf image/png image/jpeg"`
}

type TravelReceiptUploadURLResponse struct {
	UploadURL   string `json:"upload_url"`
	ReceiptPath string `json:"receipt_path"`
}

type TravelReceiptURL struct {
	Path        string `json:"path"`
	DownloadURL string `json:"download_url"`
}

type TravelReceiptURLsResponse struct {
	Receipts []TravelReceiptURL `json:"receipts"`
}

// travelRSVPEligibility returns nil when the application may view/submit the
// travel RSVP form: accepted, spot claimed, and travel reimbursement approved.
func travelRSVPEligibility(application *store.Application) error {
	if application.Status != store.StatusAccepted {
		return errors.New("application is not accepted")
	}
	if application.RSVPStatus != store.RSVPConfirmed {
		return errors.New("spot has not been claimed")
	}
	if application.TravelStatus != store.TravelApproved {
		return errors.New("travel reimbursement is not approved")
	}
	return nil
}

// getMyTravelRSVPHandler returns the authenticated user's travel RSVP state and form schema
//
//	@Summary		Get travel RSVP
//	@Description	Returns the authenticated user's travel RSVP state along with the configurable travel RSVP form schema and whether travel RSVPs are currently open. Requires an accepted application with a confirmed RSVP and approved travel reimbursement.
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	TravelRSVPResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}	"Not accepted, spot not claimed, or travel not approved"
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me/travel-rsvp [get]
func (app *application) getMyTravelRSVPHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
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

	if err := travelRSVPEligibility(application); err != nil {
		app.forbiddenResponse(w, r, err)
		return
	}

	schema, err := app.store.Settings.GetTravelRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	enabled, err := app.store.Settings.GetTravelRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPResponse{
		TravelRSVPStatus:          application.TravelRSVPStatus,
		TravelRSVPResponses:       application.TravelRSVPResponses,
		TravelRSVPSubmittedAt:     application.TravelRSVPSubmittedAt,
		TravelReceiptPaths:        application.TravelReceiptPaths,
		TravelRSVPSchema:          schema,
		TravelRSVPEnabled:         enabled,
		TravelApprovedAmountCents: application.TravelApprovedAmountCents,
		ReceiptRequiredFieldID:    travelModeFieldID,
		ReceiptRequiredValue:      travelModeFlying,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// submitMyTravelRSVPHandler submits the authenticated user's one-shot travel RSVP
//
//	@Summary		Submit travel RSVP
//	@Description	Submits the authenticated user's travel RSVP (confirm with travel details and receipt uploads, or decline the reimbursement). Confirming requires all required travel RSVP schema fields, and at least one receipt when flying. Requires an accepted application with a confirmed RSVP, approved travel, and a pending travel RSVP. This is a one-shot action.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			travel_rsvp	body		SubmitTravelRSVPPayload	true	"Travel RSVP decision, form responses, and receipt paths"
//	@Success		200			{object}	TravelRSVPResponse
//	@Failure		400			{object}	object{error=string}	"Missing required fields or invalid receipts"
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}	"Not eligible or travel RSVPs closed"
//	@Failure		404			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}	"Travel RSVP already submitted"
//	@Security		CookieAuth
//	@Router			/applications/me/travel-rsvp [post]
func (app *application) submitMyTravelRSVPHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
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

	if err := travelRSVPEligibility(application); err != nil {
		app.forbiddenResponse(w, r, err)
		return
	}

	if application.TravelRSVPStatus != store.RSVPPending {
		app.conflictResponse(w, r, errors.New("travel rsvp already submitted"))
		return
	}

	var req SubmitTravelRSVPPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	schema, err := app.store.Settings.GetTravelRSVPSchema(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Declining the reimbursement never requires form answers or receipts;
	// confirming must satisfy the configured travel RSVP schema.
	travelRSVPResponses := json.RawMessage(`{}`)
	receiptPaths := []string{}
	if req.Status == store.RSVPConfirmed {
		responses := make(map[string]interface{})
		if req.Responses != nil {
			if err := json.Unmarshal(req.Responses, &responses); err != nil {
				app.badRequestResponse(w, r, errors.New("responses must be a JSON object"))
				return
			}
		}

		if validationErrors := validateResponses(schema, responses, true); len(validationErrors) > 0 {
			app.badRequestResponse(w, r, fmt.Errorf("validation errors: %v", validationErrors))
			return
		}

		for _, receiptPath := range req.ReceiptPaths {
			if !validTravelReceiptObjectPath(receiptPath, user.ID) {
				app.badRequestResponse(w, r, errors.New("invalid receipt path"))
				return
			}
		}

		if mode, _ := responses[travelModeFieldID].(string); mode == travelModeFlying && len(req.ReceiptPaths) == 0 {
			app.badRequestResponse(w, r, errors.New("at least one ticket receipt is required when flying"))
			return
		}

		if req.Responses != nil {
			travelRSVPResponses = req.Responses
		}
		receiptPaths = req.ReceiptPaths
	}

	application.TravelRSVPStatus = req.Status
	application.TravelRSVPResponses = travelRSVPResponses
	application.TravelReceiptPaths = receiptPaths

	if err := app.store.Application.SubmitTravelRSVP(r.Context(), application); err != nil {
		if errors.Is(err, store.ErrConflict) {
			app.conflictResponse(w, r, errors.New("travel rsvp already submitted"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	enabled, err := app.store.Settings.GetTravelRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := TravelRSVPResponse{
		TravelRSVPStatus:          application.TravelRSVPStatus,
		TravelRSVPResponses:       application.TravelRSVPResponses,
		TravelRSVPSubmittedAt:     application.TravelRSVPSubmittedAt,
		TravelReceiptPaths:        application.TravelReceiptPaths,
		TravelRSVPSchema:          schema,
		TravelRSVPEnabled:         enabled,
		TravelApprovedAmountCents: application.TravelApprovedAmountCents,
		ReceiptRequiredFieldID:    travelModeFieldID,
		ReceiptRequiredValue:      travelModeFlying,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

func travelReceiptStoragePrefix(hackathonName string) string {
	return fmt.Sprintf("hackathons/%s/travel-receipts/", slug.Hackathon(hackathonName))
}

// travelReceiptObjectOwner returns the user a receipt object belongs to, and
// whether the path has the shape this API issues at all: the hackathon
// namespace, a per-user folder, and the random 128-bit name and extension.
func travelReceiptObjectOwner(objectPath string) (string, bool) {
	parts := strings.Split(objectPath, "/")
	if len(parts) != 5 ||
		parts[0] != strings.TrimSuffix(hackathonStorageRootPrefix, "/") ||
		parts[1] == "" ||
		parts[2] != "travel-receipts" ||
		parts[3] == "" {
		return "", false
	}
	fileName := parts[4]

	dot := strings.LastIndex(fileName, ".")
	if dot <= 0 {
		return "", false
	}
	ext := fileName[dot+1:]
	validExt := false
	for _, allowed := range travelReceiptContentTypes {
		if ext == allowed {
			validExt = true
			break
		}
	}
	if !validExt {
		return "", false
	}

	objectID := fileName[:dot]
	if len(objectID) != randomResumeObjectIDBytes*2 {
		return "", false
	}
	if _, err := hex.DecodeString(objectID); err != nil {
		return "", false
	}

	return parts[3], true
}

// isTravelReceiptObjectPath reports whether an object in the bucket is a travel
// receipt, whoever uploaded it.
func isTravelReceiptObjectPath(objectPath string) bool {
	_, ok := travelReceiptObjectOwner(objectPath)
	return ok
}

// validTravelReceiptObjectPath prevents clients from attaching arbitrary bucket
// objects as receipts. A receipt path must belong to the authenticated user and
// use the random 128-bit name and extension issued by this API.
func validTravelReceiptObjectPath(objectPath, userID string) bool {
	owner, ok := travelReceiptObjectOwner(objectPath)
	return ok && owner == userID
}

// generateTravelReceiptUploadURLHandler returns a signed upload URL for travel receipt uploads.
//
//	@Summary		Generate travel receipt upload URL
//	@Description	Generates a signed GCS upload URL for a travel receipt (PDF, PNG, or JPEG). Requires an accepted application with a confirmed RSVP, approved travel, and a pending travel RSVP.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		TravelReceiptUploadURLPayload	true	"Receipt content type"
//	@Success		200		{object}	TravelReceiptUploadURLResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Failure		503		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me/travel-rsvp/receipt-upload-url [post]
func (app *application) generateTravelReceiptUploadURLHandler(w http.ResponseWriter, r *http.Request) {
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

	if err := travelRSVPEligibility(application); err != nil {
		app.forbiddenResponse(w, r, err)
		return
	}

	if application.TravelRSVPStatus != store.RSVPPending {
		app.conflictResponse(w, r, errors.New("travel rsvp already submitted"))
		return
	}

	var req TravelReceiptUploadURLPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("travel receipt upload url requested but gcs is not configured", "user_id", user.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "receipt uploads are not configured")
		return
	}

	randomID, err := randomHex(randomResumeObjectIDBytes)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	hackathonName, err := app.store.Settings.GetHackathonName(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	objectPath := fmt.Sprintf("%s%s/%s.%s", travelReceiptStoragePrefix(hackathonName), user.ID, randomID, travelReceiptContentTypes[req.ContentType])

	var uploadURL string
	if req.ContentType == "application/pdf" {
		uploadURL, err = app.gcsClient.GenerateUploadURL(r.Context(), objectPath)
	} else {
		uploadURL, err = app.gcsClient.GenerateImageUploadURL(r.Context(), objectPath, req.ContentType)
	}
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, TravelReceiptUploadURLResponse{
		UploadURL:   uploadURL,
		ReceiptPath: objectPath,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getMyTravelReceiptURLHandler returns a signed download URL for one of the
// authenticated user's own receipts so they can preview it before submitting.
//
//	@Summary		Get my travel receipt download URL
//	@Description	Generates a signed GCS download URL for one of the authenticated user's travel receipts.
//	@Tags			hackers
//	@Produce		json
//	@Param			path	query		string	true	"Receipt object path"
//	@Success		200		{object}	ResumeDownloadURLResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Failure		503		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me/travel-rsvp/receipt-url [get]
func (app *application) getMyTravelReceiptURLHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("missing user in context"))
		return
	}

	receiptPath := r.URL.Query().Get("path")
	if !validTravelReceiptObjectPath(receiptPath, user.ID) {
		app.badRequestResponse(w, r, errors.New("invalid receipt path"))
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("travel receipt download url requested but gcs is not configured", "user_id", user.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "receipt downloads are not configured")
		return
	}

	downloadURL, err := app.gcsClient.GenerateDownloadURL(r.Context(), receiptPath)
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

// getTravelReceiptURLsHandler returns signed download URLs for an application's
// travel receipts so admins can verify proof of travel.
//
//	@Summary		Get travel receipt download URLs (Admin)
//	@Description	Generates signed GCS download URLs for all of an application's travel receipts.
//	@Tags			admin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	TravelReceiptURLsResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Failure		503				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/applications/{applicationID}/travel-receipt-urls [get]
func (app *application) getTravelReceiptURLsHandler(w http.ResponseWriter, r *http.Request) {
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

	if len(application.TravelReceiptPaths) == 0 {
		app.notFoundResponse(w, r, errors.New("no travel receipts found"))
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("travel receipt download urls requested but gcs is not configured", "application_id", application.ID)
		writeJSONError(w, http.StatusServiceUnavailable, "receipt downloads are not configured")
		return
	}

	receipts := make([]TravelReceiptURL, 0, len(application.TravelReceiptPaths))
	for _, receiptPath := range application.TravelReceiptPaths {
		downloadURL, err := app.gcsClient.GenerateDownloadURL(r.Context(), receiptPath)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		receipts = append(receipts, TravelReceiptURL{
			Path:        receiptPath,
			DownloadURL: downloadURL,
		})
	}

	if err := app.jsonResponse(w, http.StatusOK, TravelReceiptURLsResponse{
		Receipts: receipts,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// resetApplicationTravelRSVPHandler clears a hacker's one-shot travel RSVP
//
//	@Summary		Reset travel RSVP (Super Admin)
//	@Description	Clears a hacker's submitted travel RSVP so they can fill the travel form again, and removes their uploaded receipts from object storage. The event RSVP is left untouched. Also the way to unpin a travel decision after the hacker has submitted their travel form.
//	@Tags			superadmin/applications
//	@Produce		json
//	@Param			applicationID	path		string	true	"Application ID"
//	@Success		200				{object}	ApplicationResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/applications/{applicationID}/travel-rsvp/reset [post]
func (app *application) resetApplicationTravelRSVPHandler(w http.ResponseWriter, r *http.Request) {
	applicationID := chi.URLParam(r, "applicationID")
	if applicationID == "" {
		app.badRequestResponse(w, r, errors.New("application ID is required"))
		return
	}

	application, receiptPaths, err := app.store.Application.ResetTravelRSVP(r.Context(), applicationID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("application not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.logRSVPReset(r, "travel_rsvp", application, receiptPaths)
	app.deleteTravelReceiptObjects(receiptPaths)

	if err := app.jsonResponse(w, http.StatusOK, ApplicationResponse{Application: application}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteTravelReceiptObjects removes detached receipt files from object storage
// on a best-effort basis, using its own context so a client that walks away
// mid-request does not leave half the objects behind. The rows are already
// cleared, so failures are logged rather than surfaced.
func (app *application) deleteTravelReceiptObjects(paths []string) {
	if len(paths) == 0 {
		return
	}

	if app.gcsClient == nil {
		app.logger.Warnw("travel receipts left in object storage: no GCS client configured", "count", len(paths))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), travelReceiptDeleteTimeout)
	defer cancel()

	for _, path := range paths {
		if err := app.gcsClient.DeleteObject(ctx, path); err != nil {
			app.logger.Errorw("failed to delete travel receipt from object storage", "path", path, "error", err)
		}
	}
}
