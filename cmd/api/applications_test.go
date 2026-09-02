package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newCompleteApplication returns a fully filled application ready for submission
func newCompleteApplication(userID string) *store.Application {
	return &store.Application{
		ID:     "app-1",
		UserID: userID,
		Status: store.StatusDraft,
		Responses: json.RawMessage(`{
			"first_name":"John","last_name":"Doe","phone":"+11234567890",
			"age":20,"country_of_residence":"US","gender":"Male","race":"Asian",
			"ethnicity":"Not Hispanic","university":"UT Dallas","major":"CS",
			"level_of_study":"Undergraduate","hackathons_attended":2,
			"experience_level":"Intermediate","heard_about":"Friend",
			"shirt_size":"M",
			"ack_mlh_coc":true,"ack_mlh_data_sharing":true,
			"ack_mlh_contest_terms":true,"ack_mlh_privacy_policy":true
		}`),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestGetOrCreateApplication(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockScans := app.store.Scans.(*store.MockScansStore)

	t.Run("should return existing application", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		schema := []store.ApplicationSchemaField{{ID: "first_name", Type: "text", Label: "First Name"}}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(15, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				Points int `json:"points"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, 15, envelope.Data.Points)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("should create draft when no application exists", func(t *testing.T) {
		user := newTestUser()
		schema := []store.ApplicationSchemaField{}

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()
		mockApps.On("Create", mock.AnythingOfType("*store.Application")).Return(nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	t.Run("should handle race condition on create conflict", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		schema := []store.ApplicationSchemaField{}

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()
		mockApps.On("Create", mock.AnythingOfType("*store.Application")).Return(store.ErrConflict).Once()
		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})
}

func TestUpdateApplication(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should update draft application responses", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name"},
			{ID: "age", Type: "number", Label: "Age"},
		}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockApps.On("Update", mock.AnythingOfType("*store.Application")).Return(nil).Once()
		app.store.Scans.(*store.MockScansStore).On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		body := `{"responses": {"first_name": "Jane", "last_name": "Doe"}}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				ApplicationSchema []store.ApplicationSchemaField `json:"application_schema"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Len(t, envelope.Data.ApplicationSchema, len(schema))

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject wrong-typed value without enforcing required fields", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "age", Type: "number", Label: "Age"},
		}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()

		// age is a non-numeric string; required first_name is omitted but must not error
		body := `{"responses": {"age": "abc"}}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject a resume path outside the authenticated user's namespace", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return([]store.ApplicationSchemaField{}, nil).Once()

		body := `{"resume_path":"hackathons/hackutd-2027/resumes/another-user/0123456789abcdef0123456789abcdef.pdf"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 409 when application is already submitted", func(t *testing.T) {
		user := newTestUser()
		existing := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted}

		mockApps.On("GetByUserID", user.ID).Return(existing, nil).Once()

		body := `{"responses": {"first_name": "Jane"}}`
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

		body := `{"responses": {"first_name": "Jane"}}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

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
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "last_name", Type: "text", Label: "Last Name", Required: true},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		// No travel opt-in checkbox in this schema, so the binding is inactive
		mockApps.On("Submit", application, "").Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should pass the travel opt-in binding when the schema declares it", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "last_name", Type: "text", Label: "Last Name", Required: true},
			{ID: travelOptInFieldID, Type: "checkbox", Label: "Travel reimbursement"},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockApps.On("Submit", application, travelOptInFieldID).Return(nil).Once()

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
		// empty draft application — no responses
		application := &store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()

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
		assert.Contains(t, body.Error, "validation errors")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when required field is blank", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		application.Responses = json.RawMessage(`{"first_name":"","last_name":"Doe"}`)

		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "last_name", Type: "text", Label: "Last Name", Required: true},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()

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
		assert.Contains(t, body.Error, "first_name is required")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when select field has invalid option", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		application.Responses = json.RawMessage(`{"first_name":"John","gender":"InvalidOption"}`)

		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "gender", Type: "select", Label: "Gender", Required: false, Options: []string{"Male", "Female", "Other"}},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()

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
		assert.Contains(t, body.Error, "gender has invalid option")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when number field exceeds max", func(t *testing.T) {
		user := newTestUser()
		application := newCompleteApplication(user.ID)
		application.Responses = json.RawMessage(`{"first_name":"John","last_name":"Doe","age":200}`)

		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text", Label: "First Name", Required: true},
			{ID: "last_name", Type: "text", Label: "Last Name", Required: true},
			{ID: "age", Type: "number", Label: "Age", Required: false, Validation: map[string]interface{}{"min": float64(1), "max": float64(150)}},
		}

		mockApps.On("GetByUserID", user.ID).Return(application, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()

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
		assert.Contains(t, body.Error, "age must be at most")

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

	t.Run("should return 400 for search too short", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?search=a", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should accept valid search param", func(t *testing.T) {
		search := "john"
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{Search: &search},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?search=john", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
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

	t.Run("should accept form response filters", func(t *testing.T) {
		rsvpStatus := store.RSVPConfirmed
		travelRSVPStatus := store.RSVPPending
		travelStatus := store.TravelApproved
		hasReceipts := true
		travelRequested := true
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{
				TravelStatus:     &travelStatus,
				RSVPStatus:       &rsvpStatus,
				TravelRSVPStatus: &travelRSVPStatus,
				HasReceipts:      &hasReceipts,
				TravelRequested:  &travelRequested,
			},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(
			http.MethodGet,
			"/?travel_status=approved&rsvp_status=confirmed&travel_rsvp_status=pending&has_receipts=true&travel_requested=true",
			nil,
		)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should reject invalid form response filters", func(t *testing.T) {
		for _, query := range []string{
			"?rsvp_status=maybe",
			"?travel_rsvp_status=maybe",
			"?has_receipts=maybe",
			"?travel_requested=maybe",
		} {
			req, err := http.NewRequest(http.MethodGet, "/"+query, nil)
			require.NoError(t, err)
			req = setUserContext(req, newAdminUser())

			rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
		}
	})

	t.Run("should return 400 for invalid sort_by", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/?sort_by=invalid", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should accept valid sort_by accept_votes", func(t *testing.T) {
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{SortBy: store.SortByAcceptVotes},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?sort_by=accept_votes", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should accept sort_by with status filter", func(t *testing.T) {
		status := store.StatusSubmitted
		result := &store.ApplicationListResult{
			Applications: []store.ApplicationListItem{},
			HasMore:      false,
		}

		mockApps.On("List",
			store.ApplicationListFilters{Status: &status, SortBy: store.SortByRejectVotes},
			(*store.ApplicationCursor)(nil),
			store.DirectionForward,
			50,
		).Return(result, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/?status=submitted&sort_by=reject_votes", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listApplicationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestGetApplication(t *testing.T) {
	schema := []store.ApplicationSchemaField{{ID: "first_name", Type: "text", Label: "First Name"}}

	newRequest := func(t *testing.T, applicationID string) *http.Request {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", applicationID)
		return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	}

	t.Run("should return application with points", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		existing := newCompleteApplication("user-1")
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").Return(42, nil).Once()

		rr := executeRequest(newRequest(t, "app-1"), http.HandlerFunc(app.getApplication))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				Points int `json:"points"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, 42, envelope.Data.Points)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockScans.AssertExpectations(t)
	})

	// Points are cosmetic — a failed lookup must not fail the whole read.
	t.Run("should still return 200 with 0 points when lookup fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)

		existing := newCompleteApplication("user-1")
		mockApps.On("GetByID", "app-1").Return(existing, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockScans.On("GetTotalPointsByUserID", "user-1").
			Return(0, errors.New("scans unavailable")).Once()

		rr := executeRequest(newRequest(t, "app-1"), http.HandlerFunc(app.getApplication))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				Points int `json:"points"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, 0, envelope.Data.Points)

		mockScans.AssertExpectations(t)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)

		mockApps.On("GetByID", "nonexistent").Return(nil, store.ErrNotFound).Once()

		rr := executeRequest(newRequest(t, "nonexistent"), http.HandlerFunc(app.getApplication))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

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

func TestSetApplicationTravelStatus(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)

	t.Run("should set travel status to approved", func(t *testing.T) {
		returned := &store.Application{ID: "app-1", TravelStatus: store.TravelApproved}
		mockApps.On("SetTravelStatus", "app-1", store.TravelApproved, mock.AnythingOfType("*int64")).Return(returned, nil).Once()

		body := `{"travel_status":"approved","approved_amount_cents":32500}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationTravelStatus))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should require an amount when approving travel", func(t *testing.T) {
		body := `{"travel_status":"approved"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationTravelStatus))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		assert.Contains(t, rr.Body.String(), "approved_amount_cents")
	})

	t.Run("should return 400 for invalid travel status value", func(t *testing.T) {
		body := `{"travel_status":"not_requested"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationTravelStatus))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		mockApps.On("SetTravelStatus", "nonexistent", store.TravelRejected, (*int64)(nil)).Return(nil, store.ErrNotFound).Once()

		body := `{"travel_status":"rejected"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.setApplicationTravelStatus))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})

	// Each refusal reason gets its own message, since they call for different
	// fixes: nothing to decide, decide the application first, or reset the
	// travel RSVP before revoking the approval it was submitted under.
	conflicts := []struct {
		name        string
		storeErr    error
		wantMessage string
	}{
		{
			name:        "applicant did not request travel",
			storeErr:    store.ErrTravelNotRequested,
			wantMessage: "did not request travel reimbursement",
		},
		{
			name:        "application is rejected or still a draft",
			storeErr:    store.ErrTravelStatusNotDecidable,
			wantMessage: "draft or rejected application",
		},
		{
			name:        "travel RSVP is already submitted",
			storeErr:    store.ErrTravelRSVPSubmitted,
			wantMessage: "reset it before changing the travel decision",
		},
	}

	for _, tc := range conflicts {
		t.Run("should return 409 when "+tc.name, func(t *testing.T) {
			mockApps.On("SetTravelStatus", "app-1", store.TravelApproved, mock.AnythingOfType("*int64")).Return(nil, tc.storeErr).Once()

			body := `{"travel_status":"approved","approved_amount_cents":32500}`
			req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			req = setUserContext(req, newSuperAdminUser())
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("applicationID", "app-1")
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			rr := executeRequest(req, http.HandlerFunc(app.setApplicationTravelStatus))
			checkResponseCode(t, http.StatusConflict, rr.Code)

			var errBody struct {
				Error string `json:"error"`
			}
			require.NoError(t, json.NewDecoder(rr.Body).Decode(&errBody))
			assert.Contains(t, errBody.Error, tc.wantMessage)

			mockApps.AssertExpectations(t)
		})
	}
}
