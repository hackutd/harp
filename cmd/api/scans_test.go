package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetScanTypes(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("returns scan types", func(t *testing.T) {
		scanTypes := []store.ScanType{
			{Name: "check_in", DisplayName: "Check In", Category: store.ScanCategoryCheckIn, IsActive: true},
			{Name: "lunch", DisplayName: "Lunch", Category: store.ScanCategoryMeal, IsActive: true},
		}

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getScanTypesHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScanTypesResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.ScanTypes, 2)
		assert.Equal(t, "check_in", body.Data.ScanTypes[0].Name)

		mockSettings.AssertExpectations(t)
	})
}

func TestCreateScan(t *testing.T) {
	scanTypes := []store.ScanType{
		{Name: "check_in", DisplayName: "Check In", Category: store.ScanCategoryCheckIn, IsActive: true},
		{Name: "lunch", DisplayName: "Lunch", Category: store.ScanCategoryMeal, IsActive: true},
		{Name: "inactive_item", DisplayName: "Inactive", Category: store.ScanCategorySwag, IsActive: false},
	}

	t.Run("check_in success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("item scan when checked in", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockScans.On("HasCheckIn", "user-1", []string{"check_in"}).Return(true, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()

		body := `{"user_id":"user-1","scan_type":"lunch"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("403 not checked in", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockScans.On("HasCheckIn", "user-1", []string{"check_in"}).Return(false, nil).Once()

		body := `{"user_id":"user-1","scan_type":"lunch"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("409 duplicate", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(store.ErrConflict).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("400 invalid type", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()

		body := `{"user_id":"user-1","scan_type":"nonexistent"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("400 inactive type", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()

		body := `{"user_id":"user-1","scan_type":"inactive_item"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("400 bad body", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{invalid`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetUserScans(t *testing.T) {
	t.Run("returns scans", func(t *testing.T) {
		app := newTestApplication(t)
		mockScans := app.store.Scans.(*store.MockScansStore)

		scans := []store.Scan{
			{ID: "scan-1", UserID: "user-1", ScanType: "check_in", ScannedBy: "admin-1", ScannedAt: time.Now(), CreatedAt: time.Now()},
			{ID: "scan-2", UserID: "user-1", ScanType: "lunch", ScannedBy: "admin-1", ScannedAt: time.Now(), CreatedAt: time.Now()},
		}

		mockScans.On("GetByUserID", "user-1").Return(scans, nil).Once()

		r := chi.NewRouter()
		r.Get("/scans/user/{userID}", app.getUserScansHandler)
		req, err := http.NewRequest(http.MethodGet, "/scans/user/user-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScansResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Scans, 2)

		mockScans.AssertExpectations(t)
	})

	t.Run("empty list", func(t *testing.T) {
		app := newTestApplication(t)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockScans.On("GetByUserID", "user-2").Return([]store.Scan{}, nil).Once()

		r := chi.NewRouter()
		r.Get("/scans/user/{userID}", app.getUserScansHandler)
		req, err := http.NewRequest(http.MethodGet, "/scans/user/user-2", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScansResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Empty(t, body.Data.Scans)

		mockScans.AssertExpectations(t)
	})

	t.Run("400 missing userID", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getUserScansHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetScanStats(t *testing.T) {
	t.Run("returns stats", func(t *testing.T) {
		app := newTestApplication(t)
		mockScans := app.store.Scans.(*store.MockScansStore)

		stats := []store.ScanStat{
			{ScanType: "check_in", Count: 50},
			{ScanType: "lunch", Count: 30},
		}

		mockScans.On("GetStats").Return(stats, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getScanStatsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScanStatsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Stats, 2)
		assert.Equal(t, 50, body.Data.Stats[0].Count)

		mockScans.AssertExpectations(t)
	})
}

func TestUpdateScanTypes(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		types := []store.ScanType{
			{Name: "check_in", DisplayName: "Check In", Category: store.ScanCategoryCheckIn, IsActive: true},
			{Name: "lunch", DisplayName: "Lunch", Category: store.ScanCategoryMeal, IsActive: true},
		}

		mockSettings.On("UpdateScanTypes", types).Return(nil).Once()

		body := `{"scan_types":[{"name":"check_in","display_name":"Check In","category":"check_in","is_active":true},{"name":"lunch","display_name":"Lunch","category":"meal","is_active":true}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateScanTypesHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("400 duplicate names", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"scan_types":[{"name":"check_in","display_name":"Check In","category":"check_in","is_active":true},{"name":"check_in","display_name":"Check In 2","category":"check_in","is_active":true}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateScanTypesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&errBody)
		require.NoError(t, err)
		assert.Contains(t, errBody.Error, "duplicate scan type name")
	})

	t.Run("400 no check_in category", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"scan_types":[{"name":"lunch","display_name":"Lunch","category":"meal","is_active":true}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateScanTypesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&errBody)
		require.NoError(t, err)
		assert.Contains(t, errBody.Error, "check_in category")
	})

	t.Run("400 empty body", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateScanTypesHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}
