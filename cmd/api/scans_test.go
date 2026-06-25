package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/mailer"
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
		mockApps := app.store.Application.(*store.MockApplicationStore)

		groups := []string{"A", "B"}
		hackerApp := &store.Application{ID: "app-1", UserID: "user-1", MealGroup: nil}

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockApps.On("GetStatusByUserID", "user-1").Return(store.StatusAccepted, nil).Once()
		mockSettings.On("GetMealGroups").Return(groups, nil).Once()
		mockApps.On("GetByUserID", "user-1").Return(hackerApp, nil).Once()
		mockApps.On("SetMealGroup", "app-1", mock.AnythingOfType("string")).
			Return(&groups[0], nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var resp struct {
			Data CreateScanResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.NotNil(t, resp.Data.MealGroup)
		assert.Contains(t, groups, *resp.Data.MealGroup)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockApps.AssertExpectations(t)
	})

	t.Run("check_in keeps existing meal group", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		groups := []string{"A", "B"}
		existing := "B"
		hackerApp := &store.Application{ID: "app-1", UserID: "user-1", MealGroup: &existing}

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockApps.On("GetStatusByUserID", "user-1").Return(store.StatusAccepted, nil).Once()
		mockSettings.On("GetMealGroups").Return(groups, nil).Once()
		mockApps.On("GetByUserID", "user-1").Return(hackerApp, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var resp struct {
			Data CreateScanResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		require.NotNil(t, resp.Data.MealGroup)
		assert.Equal(t, existing, *resp.Data.MealGroup)

		// A hacker re-scanning at check-in must NOT be reassigned to a new group.
		mockApps.AssertNotCalled(t, "SetMealGroup", mock.Anything, mock.Anything)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockApps.AssertExpectations(t)
	})

	t.Run("check_in success - meal group assignment failure is non-fatal", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockApps.On("GetStatusByUserID", "user-1").Return(store.StatusAccepted, nil).Once()
		mockSettings.On("GetMealGroups").Return(nil, errors.New("db error")).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var resp struct {
			Data CreateScanResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Nil(t, resp.Data.MealGroup)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockApps.AssertExpectations(t)
	})

	t.Run("item scan when checked in", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mealGroup := "A"

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockScans.On("HasCheckIn", "user-1", []string{"check_in"}).Return(true, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()
		mockApps.On("GetMealGroupByUserID", "user-1").Return(&mealGroup, nil).Once()

		body := `{"user_id":"user-1","scan_type":"lunch"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockApps.AssertExpectations(t)
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
		mockApp := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(scanTypes, nil).Once()
		mockApp.On("GetStatusByUserID", "user-1").Return(store.StatusAccepted, nil).Once()
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
		mockApp.AssertExpectations(t)
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

	walkInScanTypes := []store.ScanType{
		{Name: "check_in", DisplayName: "Check In", Category: store.ScanCategoryCheckIn, IsActive: true},
		{Name: "walk_in", DisplayName: "Walk-In", Category: store.ScanCategoryWalkIn, IsActive: true},
		{Name: "lunch", DisplayName: "Lunch", Category: store.ScanCategoryMeal, IsActive: true},
	}

	t.Run("walk-in scan enqueues user and fires queued email", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(walkInScanTypes, nil).Once()
		mockUsers.On("GetByID", "user-1").Return(&store.User{ID: "user-1", Email: "hacker@test.com"}, nil).Once()
		mockWalkIns.On("Enqueue", "user-1").Return(true, 7, nil).Once()
		mockMailer.On("SendWalkInQueuedEmail", "hacker@test.com", 7).Return(nil).Maybe()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()
		mockApps.On("GetMealGroupByUserID", "user-1").Return((*string)(nil), store.ErrNotFound).Once()

		body := `{"user_id":"user-1","scan_type":"walk_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockUsers.AssertExpectations(t)
		mockWalkIns.AssertExpectations(t)
	})

	t.Run("walk-in re-scan is no-op, no second email", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(walkInScanTypes, nil).Once()
		mockUsers.On("GetByID", "user-1").Return(&store.User{ID: "user-1", Email: "hacker@test.com"}, nil).Once()
		mockWalkIns.On("Enqueue", "user-1").Return(false, 0, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()
		mockApps.On("GetMealGroupByUserID", "user-1").Return((*string)(nil), store.ErrNotFound).Once()

		body := `{"user_id":"user-1","scan_type":"walk_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockMailer.AssertNotCalled(t, "SendWalkInQueuedEmail", mock.Anything, mock.Anything)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
		mockWalkIns.AssertExpectations(t)
	})

	t.Run("walk-in scan does not require prior check-in", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		mockUsers := app.store.Users.(*store.MockUsersStore)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)

		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(walkInScanTypes, nil).Once()
		mockUsers.On("GetByID", "user-1").Return(&store.User{ID: "user-1", Email: "hacker@test.com"}, nil).Once()
		mockWalkIns.On("Enqueue", "user-1").Return(false, 0, nil).Once()
		mockScans.On("Create", mock.AnythingOfType("*store.Scan")).Return(nil).Once()
		mockApps.On("GetMealGroupByUserID", "user-1").Return((*string)(nil), store.ErrNotFound).Once()

		body := `{"user_id":"user-1","scan_type":"walk_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		// Should succeed without any HasCheckIn mock — walk-in bypasses that check
		checkResponseCode(t, http.StatusCreated, rr.Code)
	})

	t.Run("check-in scan of waitlisted user returns 403", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockApp := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(walkInScanTypes, nil).Once()
		mockApp.On("GetStatusByUserID", "user-1").Return(store.StatusWaitlisted, nil).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockSettings.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})

	t.Run("check-in scan of user with no application returns 403", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockApp := app.store.Application.(*store.MockApplicationStore)

		mockSettings.On("GetScanTypes").Return(walkInScanTypes, nil).Once()
		mockApp.On("GetStatusByUserID", "user-1").Return(store.ApplicationStatus(""), store.ErrNotFound).Once()

		body := `{"user_id":"user-1","scan_type":"check_in"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScanHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockSettings.AssertExpectations(t)
		mockApp.AssertExpectations(t)
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

func TestRebalanceScanStats(t *testing.T) {
	t.Run("admin recomputes stats", func(t *testing.T) {
		app := newTestApplication(t)
		mockScans := app.store.Scans.(*store.MockScansStore)

		stats := []store.ScanStat{
			{ScanType: "check_in", Count: 42},
			{ScanType: "lunch", Count: 17},
		}

		mockScans.On("RebalanceStats").Return(stats, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.rebalanceScanStatsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScanStatsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Stats, 2)
		assert.Equal(t, "check_in", body.Data.Stats[0].ScanType)
		assert.Equal(t, 42, body.Data.Stats[0].Count)

		mockScans.AssertExpectations(t)
	})

	t.Run("500 on store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockScans := app.store.Scans.(*store.MockScansStore)

		mockScans.On("RebalanceStats").Return(nil, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.rebalanceScanStatsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockScans.AssertExpectations(t)
	})

	t.Run("403 when hacker (non-admin)", func(t *testing.T) {
		app := newTestApplication(t)
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(http.HandlerFunc(app.rebalanceScanStatsHandler))

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("401 when unauthenticated", func(t *testing.T) {
		app := newTestApplication(t)
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(http.HandlerFunc(app.rebalanceScanStatsHandler))

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})
}

func TestUpdateScanTypes(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		types := []store.ScanType{
			{Name: "check_in", DisplayName: "Check In", Category: store.ScanCategoryCheckIn, IsActive: true},
			{Name: "walk_in", DisplayName: "Walk-In", Category: store.ScanCategoryWalkIn, IsActive: true},
			{Name: "lunch", DisplayName: "Lunch", Category: store.ScanCategoryMeal, IsActive: true},
		}

		mockSettings.On("UpdateScanTypes", types).Return(nil).Once()

		body := `{"scan_types":[{"name":"check_in","display_name":"Check In","category":"check_in","is_active":true},{"name":"walk_in","display_name":"Walk-In","category":"walk_in","is_active":true},{"name":"lunch","display_name":"Lunch","category":"meal","is_active":true}]}`
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

		body := `{"scan_types":[{"name":"walk_in","display_name":"Walk-In","category":"walk_in","is_active":true}]}`
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
		assert.Contains(t, errBody.Error, "check_in")
	})

	t.Run("400 no walk_in category", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"scan_types":[{"name":"check_in","display_name":"Check In","category":"check_in","is_active":true}]}`
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
		assert.Contains(t, errBody.Error, "walk_in")
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
