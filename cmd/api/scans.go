package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

// Request/Response types

type CreateScanPayload struct {
	UserID   string `json:"user_id" validate:"required"`
	ScanType string `json:"scan_type" validate:"required"`
}

type ScanTypesResponse struct {
	ScanTypes []store.ScanType `json:"scan_types"`
}

type ScansResponse struct {
	Scans []store.Scan `json:"scans"`
}

type ScanStatsResponse struct {
	Stats []store.ScanStat `json:"stats"`
}

type UpdateScanTypesPayload struct {
	ScanTypes []store.ScanType `json:"scan_types" validate:"required,dive"`
}

// getScanTypesHandler returns all configured scan types
func (app *application) getScanTypesHandler(w http.ResponseWriter, r *http.Request) {
	scanTypes, err := app.store.Settings.GetScanTypes(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScanTypesResponse{ScanTypes: scanTypes}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createScanHandler creates a scan record for a user
func (app *application) createScanHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateScanPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Get scan types from settings
	scanTypes, err := app.store.Settings.GetScanTypes(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Find the requested scan type
	var found *store.ScanType
	for i := range scanTypes {
		if scanTypes[i].Name == req.ScanType {
			found = &scanTypes[i]
			break
		}
	}

	if found == nil {
		app.badRequestResponse(w, r, errors.New("invalid scan type: "+req.ScanType))
		return
	}

	if !found.IsActive {
		app.badRequestResponse(w, r, errors.New("scan type is not active: "+req.ScanType))
		return
	}

	// For non-check_in categories, verify user has checked in
	if found.Category != store.ScanCategoryCheckIn {
		var checkInTypes []string
		for _, st := range scanTypes {
			if st.Category == store.ScanCategoryCheckIn {
				checkInTypes = append(checkInTypes, st.Name)
			}
		}

		hasCheckIn, err := app.store.Scans.HasCheckIn(r.Context(), req.UserID, checkInTypes)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if !hasCheckIn {
			app.forbiddenResponse(w, r, errors.New("user must check in before claiming items"))
			return
		}
	}

	admin := getUserFromContext(r.Context())

	scan := &store.Scan{
		UserID:    req.UserID,
		ScanType:  req.ScanType,
		ScannedBy: admin.ID,
	}

	if err := app.store.Scans.Create(r.Context(), scan); err != nil {
		if errors.Is(err, store.ErrConflict) {
			app.conflictResponse(w, r, errors.New("user already scanned for: "+req.ScanType))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, scan); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getUserScansHandler returns all scans for a user
func (app *application) getUserScansHandler(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	if userID == "" {
		app.badRequestResponse(w, r, errors.New("missing userID parameter"))
		return
	}

	scans, err := app.store.Scans.GetByUserID(r.Context(), userID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScansResponse{Scans: scans}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getScanStatsHandler returns aggregate scan counts
func (app *application) getScanStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := app.store.Scans.GetStats(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScanStatsResponse{Stats: stats}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateScanTypesHandler replaces all scan types (super admin)
func (app *application) updateScanTypesHandler(w http.ResponseWriter, r *http.Request) {
	var req UpdateScanTypesPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Validate unique names
	nameMap := make(map[string]bool)
	for _, st := range req.ScanTypes {
		if nameMap[st.Name] {
			app.badRequestResponse(w, r, errors.New("duplicate scan type name: "+st.Name))
			return
		}
		nameMap[st.Name] = true
	}

	// Validate at least one check_in category type exists
	hasCheckIn := false
	for _, st := range req.ScanTypes {
		if st.Category == store.ScanCategoryCheckIn {
			hasCheckIn = true
			break
		}
	}
	if !hasCheckIn {
		app.badRequestResponse(w, r, errors.New("must have at least one scan type with check_in category"))
		return
	}

	if err := app.store.Settings.UpdateScanTypes(r.Context(), req.ScanTypes); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScanTypesResponse{ScanTypes: req.ScanTypes}); err != nil {
		app.internalServerError(w, r, err)
	}
}
