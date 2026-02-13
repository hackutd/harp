package main

import (
	"context"
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

// newCompleteApplication returns a fully filled application ready for submission
func newCompleteApplication(userID string) *store.Application {
	firstName := "John"
	lastName := "Doe"
	phone := "+11234567890"
	age := int16(20)
	country := "US"
	gender := "Male"
	race := "Asian"
	ethnicity := "Not Hispanic"
	university := "UT Dallas"
	major := "CS"
	level := "Undergraduate"
	hackathons := int16(2)
	experience := "Intermediate"
	heard := "Friend"
	shirt := "M"

	return &store.Application{
		ID:                      "app-1",
		UserID:                  userID,
		Status:                  store.StatusDraft,
		FirstName:               &firstName,
		LastName:                &lastName,
		PhoneE164:               &phone,
		Age:                     &age,
		CountryOfResidence:      &country,
		Gender:                  &gender,
		Race:                    &race,
		Ethnicity:               &ethnicity,
		University:              &university,
		Major:                   &major,
		LevelOfStudy:            &level,
		HackathonsAttendedCount: &hackathons,
		SoftwareExperienceLevel: &experience,
		HeardAbout:              &heard,
		ShirtSize:               &shirt,
		ShortAnswerResponses:    json.RawMessage(`{"q1":"answer1"}`),
		AckApplication:          true,
		AckMLHCOC:               true,
		AckMLHPrivacy:           true,
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
	}
}

func TestGetOrCreateApplication(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return existing application", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		questions := []store.ShortAnswerQuestion{{ID: "q1", Question: "Why?"}}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should create draft when no application exists", func(t *testing.T) {
		user := newTestUser()
		questions := []store.ShortAnswerQuestion{}

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()
		mockApps.On("Create", mock.AnythingOfType("*store.Application")).Return(nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should handle race condition on create conflict", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		questions := []store.ShortAnswerQuestion{}

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()
		mockApps.On("Create", mock.AnythingOfType("*store.Application")).Return(store.ErrConflict).Once()
		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}

func TestUpdateApplication(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)

	t.Run("should update draft application fields", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockApps.On("Update", mock.AnythingOfType("*store.Application")).Return(nil).Once()

		body := `{"first_name": "Jane", "last_name": "Doe"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when application is already submitted", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()

		body := `{"first_name": "Jane"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		body := `{"first_name": "Jane"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 400 on validation failure", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()

		// age out of range
		body := `{"age": -5}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestSubmitApplication(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should submit a complete application", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why?", Required: true},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()
		mockApps.On("Submit", application).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when required fields are missing", func(t *testing.T) {
		user := newTestUser()
		// empty draft application — all fields nil
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		questions := []store.ShortAnswerQuestion{}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var body struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Contains(t, body.Error, "missing required fields")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when required short answer is blank", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		application.ShortAnswerResponses = json.RawMessage(`{"q1":""}`) // blank answer

		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why?", Required: true},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var body struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Contains(t, body.Error, "short_answer:q1")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 409 when application already submitted", func(t *testing.T) {
		user := newTestUser()
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when no application exists", func(t *testing.T) {
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestGetApplicationStats(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)

	t.Run("should return stats", func(t *testing.T) {
		stats := &store.ApplicationStats{
			TotalApplications: 100,
			Submitted:         50,
			Accepted:          20,
			Rejected:          10,
			Waitlisted:        5,
			Draft:             15,
			AcceptanceRate:    23.5,
		}

		mockApps.On("GetStats").Return(stats, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getApplicationStatsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data store.ApplicationStats `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, int64(100), body.Data.TotalApplications)

		mockApps.AssertExpectations(t)
	})
}

func TestListApplications(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)

	t.Run("should list applications with defaults", func(t *testing.T) {
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid status", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?status=invalid", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for invalid limit", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?limit=999", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for invalid direction", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?direction=sideways", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should accept valid status filter", func(t *testing.T) {
		status := store.StatusSubmitted
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{Status: &status},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?status=submitted", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestSetApplicationStatus(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)

	t.Run("should set status to accepted", func(t *testing.T) {
		returned := &store.Application{ID: "app-1", Status: store.StatusAccepted}
		mockApps.On("SetStatus", "app-1", store.StatusAccepted).Return(returned, nil).Once()

		body := `{"status":"accepted"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		// Inject chi URL param
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationStatus))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid status value", func(t *testing.T) {
		body := `{"status":"drafted"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationStatus))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		mockApps.On("SetStatus", "nonexistent", store.StatusRejected).Return(nil, store.ErrNotFound).Once()

		body := `{"status":"rejected"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationStatus))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

//func TestGetApplicantEmailsByStatus(t *testing.T) {
//	app := newTestApplication(t)
//	mockApps := app.store.Application.(*store.MockApplicationStore) //TODO: write test function. NOT FINISHED
//}
