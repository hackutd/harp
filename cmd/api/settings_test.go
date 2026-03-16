package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetShortAnswerQuestions(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return questions", func(t *testing.T) {
		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why do you want to attend?", Required: true, DisplayOrder: 0},
			{ID: "q2", Question: "Tell us about a project", Required: false, DisplayOrder: 1},
		}

		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getShortAnswerQuestions))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ShortAnswerQuestionsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Questions, 2)

		mockSettings.AssertExpectations(t)
	})
}

func TestUpdateShortAnswerQuestions(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should update questions", func(t *testing.T) {
		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why?", Required: true, DisplayOrder: 0},
		}

		mockSettings.On("UpdateShortAnswerQuestions", questions).Return(nil).Once()

		body := `{"questions":[{"id":"q1","question":"Why?","required":true,"display_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for duplicate question IDs", func(t *testing.T) {
		body := `{"questions":[{"id":"q1","question":"A?","required":true,"display_order":0},{"id":"q1","question":"B?","required":false,"display_order":1}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&errBody)
		require.NoError(t, err)
		assert.Contains(t, errBody.Error, "duplicate question ID")
	})

	t.Run("should return 400 for empty questions array", func(t *testing.T) {
		body := `{}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
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

func TestGetReviewAssignmentToggle(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockUsers := app.store.Users.(*store.MockUsersStore)

	t.Run("should return admins with toggles defaulting to true", func(t *testing.T) {
		admins := []store.User{
			{ID: "sa-1", Email: "a@test.com", Role: store.RoleSuperAdmin},
			{ID: "sa-2", Email: "b@test.com", Role: store.RoleSuperAdmin},
		}
		toggles := []store.ReviewAssignmentEntry{
			{ID: "sa-1", Enabled: false},
		}

		mockUsers.On("GetByRole", store.RoleSuperAdmin).Return(admins, nil).Once()
		mockSettings.On("GetAllReviewAssignmentToggles").Return(toggles, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getReviewAssignmentToggle))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReviewAssignmentListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		require.Len(t, body.Data.Admins, 2)
		assert.False(t, body.Data.Admins[0].Enabled)
		assert.True(t, body.Data.Admins[1].Enabled) // default to true

		mockSettings.AssertExpectations(t)
		mockUsers.AssertExpectations(t)
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
