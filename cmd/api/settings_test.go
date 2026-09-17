package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetApplicationSchema(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return schema fields", func(t *testing.T) {
		fields := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true, DisplayOrder: 0},
			{ID: "university", Type: "text", Label: "University", Required: false, DisplayOrder: 1},
		}

		mockSettings.On("GetApplicationSchema").Return(fields, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getApplicationSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ApplicationSchemaResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Fields, 2)

		mockSettings.AssertExpectations(t)
	})
}

func TestUpdateApplicationSchema(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should update schema", func(t *testing.T) {
		fields := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true, DisplayOrder: 0},
		}

		mockSettings.On("UpdateApplicationSchema", fields).Return(nil).Once()

		body := `{"fields":[{"id":"first_name","type":"text","label":"First Name","required":true,"display_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for duplicate field IDs", func(t *testing.T) {
		body := `{"fields":[{"id":"f1","type":"text","label":"A","required":true,"display_order":0},{"id":"f1","type":"text","label":"B","required":false,"display_order":1}]}`

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for empty fields array", func(t *testing.T) {
		body := `{}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetReviewsPerApp(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return current value", func(t *testing.T) {
		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getReviewsPerApp))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReviewsPerAppResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 3, body.Data.ReviewsPerApplication)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetReviewsPerApp(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should set valid value", func(t *testing.T) {
		mockSettings.On("SetReviewsPerApplication", 5).Return(nil).Once()

		body := `{"reviews_per_application":5}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ReviewsPerAppResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, 5, respBody.Data.ReviewsPerApplication)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for value over 10", func(t *testing.T) {
		body := `{"reviews_per_application":11}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for value of 0", func(t *testing.T) {
		body := `{"reviews_per_application":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestSetReviewAssignmentToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockUsers := app.store.Users.(*store.MockUsersStore)

	t.Run("happy path: set toggle for super admin", func(t *testing.T) {
		targetUser := &store.User{
			ID:    "sa-1",
			Email: "a@test.com",
			Role:  store.RoleSuperAdmin,
		}
		mockUsers.On("GetByID", "sa-1").Return(targetUser, nil).Once()
		mockSettings.On("SetReviewAssignmentToggle", "sa-1", false).Return(nil).Once()

		body := `{"user_id":"sa-1","enabled":false}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewAssignmentToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ReviewAssignmentToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "sa-1", respBody.Data.UserID)
		assert.False(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 404 for unknown user", func(t *testing.T) {
		mockUsers.On("GetByID", "unknown").Return(nil, store.ErrNotFound).Once()

		body := `{"user_id":"unknown","enabled":true}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewAssignmentToggle))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 400 for non-super-admin user", func(t *testing.T) {
		adminUser := &store.User{
			ID:    "admin-1",
			Email: "admin@test.com",
			Role:  store.RoleAdmin,
		}
		mockUsers.On("GetByID", "admin-1").Return(adminUser, nil).Once()

		body := `{"user_id":"admin-1","enabled":true}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewAssignmentToggle))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockUsers.AssertExpectations(t)
	})

	t.Run("should return 400 for missing user_id", func(t *testing.T) {
		body := `{"enabled":true}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewAssignmentToggle))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetAdminScheduleEditToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return current value", func(t *testing.T) {
		mockSettings.On("GetAdminScheduleEditEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getAdminScheduleEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data AdminScheduleEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.True(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetAdminScheduleEditToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should set enabled=true", func(t *testing.T) {
		mockSettings.On("SetAdminScheduleEditEnabled", true).Return(nil).Once()

		body := `{"enabled":true}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setAdminScheduleEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data AdminScheduleEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.True(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should set enabled=false", func(t *testing.T) {
		mockSettings.On("SetAdminScheduleEditEnabled", false).Return(nil).Once()

		body := `{"enabled":false}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setAdminScheduleEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data AdminScheduleEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.False(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestGetAdminSponsorEditToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return current value", func(t *testing.T) {
		mockSettings.On("GetAdminSponsorEditEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getAdminSponsorEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data AdminSponsorEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.True(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetAdminSponsorEditToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should set enabled=true", func(t *testing.T) {
		mockSettings.On("SetAdminSponsorEditEnabled", true).Return(nil).Once()

		body := `{"enabled":true}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setAdminSponsorEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data AdminSponsorEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.True(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should set enabled=false", func(t *testing.T) {
		mockSettings.On("SetAdminSponsorEditEnabled", false).Return(nil).Once()

		body := `{"enabled":false}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setAdminSponsorEditToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data AdminSponsorEditToggleResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.False(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestGetHackathonDateRange(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return configured range", func(t *testing.T) {
		start := "2026-03-13"
		end := "2026-03-15"
		mockSettings.On("GetHackathonDateRange").Return(store.HackathonDateRange{
			StartDate: &start,
			EndDate:   &end,
		}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getHackathonDateRange))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data HackathonDateRangeResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		require.NotNil(t, body.Data.StartDate)
		require.NotNil(t, body.Data.EndDate)
		assert.Equal(t, start, *body.Data.StartDate)
		assert.Equal(t, end, *body.Data.EndDate)
		assert.True(t, body.Data.Configured)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetHackathonDateRange(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should set valid range", func(t *testing.T) {
		start := "2026-03-13"
		end := "2026-03-15"
		mockSettings.On("SetHackathonDateRange", store.HackathonDateRange{
			StartDate: &start,
			EndDate:   &end,
		}).Return(nil).Once()

		body := `{"start_date":"2026-03-13","end_date":"2026-03-15"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonDateRange))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data HackathonDateRangeResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.True(t, respBody.Data.Configured)
		require.NotNil(t, respBody.Data.StartDate)
		require.NotNil(t, respBody.Data.EndDate)
		assert.Equal(t, start, *respBody.Data.StartDate)
		assert.Equal(t, end, *respBody.Data.EndDate)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject ranges over 7 days", func(t *testing.T) {
		body := `{"start_date":"2026-03-13","end_date":"2026-03-21"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonDateRange))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should reject when end is before start", func(t *testing.T) {
		body := `{"start_date":"2026-03-15","end_date":"2026-03-13"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonDateRange))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should reject invalid date format", func(t *testing.T) {
		body := `{"start_date":"03/13/2026","end_date":"03/15/2026"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonDateRange))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetHackerPackURL(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return configured url", func(t *testing.T) {
		url := "https://hackutd.notion.site/pack"
		mockSettings.On("GetHackerPackURL").Return(url, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getHackerPackURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data HackerPackURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, url, body.Data.URL)

		mockSettings.AssertExpectations(t)
	})
}

func TestGetHackerPackHandler(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return url for hacker", func(t *testing.T) {
		url := "https://hackutd.notion.site/pack"
		mockSettings.On("GetHackerPackURL").Return(url, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getHackerPackHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data HackerPackURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, url, body.Data.URL)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetHackerPackURL(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should trim and set valid url", func(t *testing.T) {
		mockSettings.On("SetHackerPackURL", "https://hackutd.notion.site/pack").Return(nil).Once()

		body := `{"url":"  https://hackutd.notion.site/pack  "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackerPackURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data HackerPackURLResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "https://hackutd.notion.site/pack", respBody.Data.URL)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should allow clearing with empty url", func(t *testing.T) {
		mockSettings.On("SetHackerPackURL", "").Return(nil).Once()

		body := `{"url":""}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackerPackURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject non-http url", func(t *testing.T) {
		body := `{"url":"ftp://example.com/pack"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackerPackURL))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetPointsConfigHandler(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return name and enabled state for hacker", func(t *testing.T) {
		mockSettings.On("GetPointsName").Return("Nuggets", nil).Once()
		mockSettings.On("GetPointsEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getPointsConfigHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data PointsConfigResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, "Nuggets", body.Data.Name)
		assert.True(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should report the points system as disabled", func(t *testing.T) {
		mockSettings.On("GetPointsName").Return("Nuggets", nil).Once()
		mockSettings.On("GetPointsEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getPointsConfigHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data PointsConfigResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.False(t, body.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetPointsEnabled(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should disable the points system", func(t *testing.T) {
		mockSettings.On("SetPointsEnabled", false).Return(nil).Once()

		body := `{"enabled":false}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPointsEnabled))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data PointsEnabledResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.False(t, respBody.Data.Enabled)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetPointsName(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should trim and set name", func(t *testing.T) {
		mockSettings.On("SetPointsName", "Tavern Points").Return(nil).Once()

		body := `{"name":"  Tavern Points  "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPointsName))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data PointsNameResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "Tavern Points", respBody.Data.Name)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject empty name", func(t *testing.T) {
		body := `{"name":"   "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPointsName))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should reject name over 30 characters", func(t *testing.T) {
		body := `{"name":"` + strings.Repeat("a", 31) + `"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPointsName))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetMealGroups(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return meal groups", func(t *testing.T) {
		groups := []string{"A", "B", "C"}
		mockSettings.On("GetMealGroups").Return(groups, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getMealGroups))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data MealGroupsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, groups, body.Data.Groups)

		mockSettings.AssertExpectations(t)
	})
}

func TestUpdateMealGroups(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should update meal groups", func(t *testing.T) {
		groups := []string{"Alpha", "Beta"}
		mockSettings.On("SetMealGroups", groups).Return(nil).Once()

		body := `{"groups":["Alpha", "Beta"]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateMealGroups))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for duplicate names", func(t *testing.T) {
		body := `{"groups":["A", "A"]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateMealGroups))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetMealGroupStats(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return stats", func(t *testing.T) {
		stats := map[string]int{"A": 10, "B": 20}
		mockSettings.On("GetMealGroupStats").Return(stats, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getMealGroupStats))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data MealGroupStatsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, stats, body.Data.Stats)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetHackathonName(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should trim and store the name", func(t *testing.T) {
		mockSettings.On("SetHackathonName", "HackUTD 2026").Return(nil).Once()

		body := `{"name":"  HackUTD 2026  "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonName))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data HackathonNameResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "HackUTD 2026", respBody.Data.Name)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject a blank name", func(t *testing.T) {
		body := `{"name":"   "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setHackathonName))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestSetContactEmail(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should store a valid email", func(t *testing.T) {
		mockSettings.On("SetContactEmail", "hello@hackutd.co").Return(nil).Once()

		body := `{"email":"hello@hackutd.co"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setContactEmail))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject an invalid email", func(t *testing.T) {
		body := `{"email":"not-an-email"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setContactEmail))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestSetApplicationDueDate(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should store a valid date", func(t *testing.T) {
		mockSettings.On("SetApplicationDueDate", "2026-03-14").Return(nil).Once()

		body := `{"date":"2026-03-14"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationDueDate))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data DateSettingResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.True(t, respBody.Data.Configured)
		assert.Equal(t, "2026-03-14", respBody.Data.Date)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject a non ISO date", func(t *testing.T) {
		body := `{"date":"03/14/2026"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationDueDate))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetOnboardingStatus(t *testing.T) {
	t.Run("should report complete when every setting is configured", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		start := "2026-04-04"
		end := "2026-04-05"
		mockSettings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()
		mockSettings.On("GetHackathonDateRange").Return(store.HackathonDateRange{StartDate: &start, EndDate: &end}, nil).Once()
		mockSettings.On("GetApplicationDueDate").Return("2026-03-14", nil).Once()
		mockSettings.On("GetContactEmail").Return("hello@hackutd.co", nil).Once()
		mockSettings.On("GetFromEmail").Return("noreply@hackutd.co", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getOnboardingStatus))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data OnboardingStatusResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.True(t, respBody.Data.Complete)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should report incomplete when a setting is missing", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockSettings.On("GetHackathonName").Return("", nil).Once()
		mockSettings.On("GetHackathonDateRange").Return(store.HackathonDateRange{}, nil).Once()
		mockSettings.On("GetApplicationDueDate").Return("", nil).Once()
		mockSettings.On("GetContactEmail").Return("", nil).Once()
		mockSettings.On("GetFromEmail").Return("", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getOnboardingStatus))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data OnboardingStatusResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.False(t, respBody.Data.Complete)
		assert.False(t, respBody.Data.HackathonName)

		mockSettings.AssertExpectations(t)
	})
}

func TestGetLegalConfig(t *testing.T) {
	t.Run("should return both links without a session", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockSettings.On("GetPrivacyPolicyURL").Return("https://example.com/privacy", nil).Once()
		mockSettings.On("GetTermsURL").Return("https://example.com/terms", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		// Deliberately no setUserContext: the login page calls this before
		// anyone is signed in.

		rr := executeRequest(req, http.HandlerFunc(app.getLegalConfigHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data LegalConfigResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "https://example.com/privacy", respBody.Data.PrivacyPolicyURL)
		assert.Equal(t, "https://example.com/terms", respBody.Data.TermsURL)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return empty strings when unconfigured", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		mockSettings.On("GetPrivacyPolicyURL").Return("", nil).Once()
		mockSettings.On("GetTermsURL").Return("", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.getLegalConfigHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data LegalConfigResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Empty(t, respBody.Data.PrivacyPolicyURL)
		assert.Empty(t, respBody.Data.TermsURL)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetPrivacyPolicyURL(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should store a valid https url", func(t *testing.T) {
		mockSettings.On("SetPrivacyPolicyURL", "https://example.com/privacy").Return(nil).Once()

		body := `{"url":"  https://example.com/privacy  "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPrivacyPolicyURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data URLSettingResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "https://example.com/privacy", respBody.Data.URL)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should accept an empty url to clear the link", func(t *testing.T) {
		mockSettings.On("SetPrivacyPolicyURL", "").Return(nil).Once()

		body := `{"url":""}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPrivacyPolicyURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject a url without an http scheme", func(t *testing.T) {
		body := `{"url":"example.com/privacy"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPrivacyPolicyURL))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should reject a javascript scheme", func(t *testing.T) {
		body := `{"url":"javascript:alert(1)"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPrivacyPolicyURL))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestSetTermsURL(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should store a valid url", func(t *testing.T) {
		mockSettings.On("SetTermsURL", "https://example.com/terms").Return(nil).Once()

		body := `{"url":"https://example.com/terms"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTermsURL))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject a relative url", func(t *testing.T) {
		body := `{"url":"/terms"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTermsURL))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

// The whole point of /v1/legal is that it answers before anyone has a session.
// Exercise it through the real router so a future refactor that moves the route
// inside the authenticated group fails here rather than in production.
func TestLegalConfigRouteIsUnauthenticated(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockSettings.On("GetPrivacyPolicyURL").Return("https://example.com/privacy", nil).Once()
	mockSettings.On("GetTermsURL").Return("", nil).Once()

	mux := app.mount()

	req, err := http.NewRequest(http.MethodGet, "/v1/legal", nil)
	require.NoError(t, err)

	rr := executeRequest(req, mux)
	checkResponseCode(t, http.StatusOK, rr.Code)

	var respBody struct {
		Data LegalConfigResponse `json:"data"`
	}
	err = json.NewDecoder(rr.Body).Decode(&respBody)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/privacy", respBody.Data.PrivacyPolicyURL)
	assert.Empty(t, respBody.Data.TermsURL)

	mockSettings.AssertExpectations(t)
}
