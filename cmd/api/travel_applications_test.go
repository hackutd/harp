package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// newTravelSchema returns an application schema with a regular question, the
// travel opt-in, and two follow-ups that only appear when it is ticked.
func newTravelSchema() []store.ApplicationSchemaField {
	return []store.ApplicationSchemaField{
		{ID: "first_name", Type: "text", Label: "First Name", Required: true},
		{ID: travelOptInFieldID, Type: "checkbox", Label: "Travel reimbursement", Section: "travel"},
		{
			ID: "travel_origin", Type: "text", Label: "Traveling from", Section: "travel",
			Validation: map[string]interface{}{"show_if": travelOptInFieldID, "required_if": travelOptInFieldID},
		},
		{
			ID: "travel_justification", Type: "textarea", Label: "Why", Section: "travel",
			Validation: map[string]interface{}{"required_if": travelOptInFieldID},
		},
	}
}

func schemaIDs(fields []store.ApplicationSchemaField) []string {
	ids := make([]string, 0, len(fields))
	for _, f := range fields {
		ids = append(ids, f.ID)
	}
	return ids
}

func TestTravelQuestionIDs(t *testing.T) {
	t.Run("returns the opt-in and every field conditioned on it", func(t *testing.T) {
		schema := append(newTravelSchema(),
			store.ApplicationSchemaField{
				ID: "travel_mode_other", Type: "text",
				Validation: map[string]interface{}{"show_if": travelOptInFieldID + "=true"},
			},
			store.ApplicationSchemaField{
				ID: "team_name", Type: "text",
				Validation: map[string]interface{}{"show_if": "has_team"},
			},
		)

		assert.Equal(t, map[string]bool{
			travelOptInFieldID:     true,
			"travel_origin":        true,
			"travel_justification": true,
			"travel_mode_other":    true,
		}, travelQuestionIDs(schema))
	})

	t.Run("returns nothing when the schema has no travel opt-in", func(t *testing.T) {
		schema := []store.ApplicationSchemaField{
			{ID: "first_name", Type: "text"},
			{ID: "travel_origin", Type: "text", Validation: map[string]interface{}{"show_if": travelOptInFieldID}},
		}

		assert.Empty(t, travelQuestionIDs(schema))
	})
}

func TestApplicantSchemaWithTravelClosed(t *testing.T) {
	getMe := func(t *testing.T, app *application, user *store.User) []string {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		return schemaIDs(envelope.Data.ApplicationSchema)
	}

	setup := func(t *testing.T, travelOpen bool) (*application, *store.User) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(&store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newTravelSchema(), nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(travelOpen, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()
		return app, user
	}

	t.Run("withholds the travel questions while closed", func(t *testing.T) {
		app, user := setup(t, false)
		assert.Equal(t, []string{"first_name"}, getMe(t, app, user))
	})

	t.Run("serves the full schema while open", func(t *testing.T) {
		app, user := setup(t, true)
		assert.Equal(t, schemaIDs(newTravelSchema()), getMe(t, app, user))
	})

	t.Run("skips the setting when the schema has no travel opt-in", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(&store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}, nil).Once()
		mockSettings.On("GetApplicationSchema").Return([]store.ApplicationSchemaField{{ID: "first_name", Type: "text"}}, nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		assert.Equal(t, []string{"first_name"}, getMe(t, app, user))
		mockSettings.AssertNotCalled(t, "GetTravelApplicationsEnabled")
	})

	t.Run("returns 500 when the setting cannot be read", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(&store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newTravelSchema(), nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, assert.AnError).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestSubmitApplicationWithTravelClosed(t *testing.T) {
	submit := func(t *testing.T, app *application, user *store.User) int {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)
		return executeRequest(req, http.HandlerFunc(app.submitApplicationHandler)).Code
	}

	t.Run("drops travel answers from an earlier draft and requests no travel", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		// Ticked while travel was open, follow-ups left blank: neither the
		// opt-in nor the now-withheld required follow-ups may count.
		draft := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusDraft,
			Responses: json.RawMessage(`{"first_name":"Ada","travel_reimbursement":true,"travel_origin":"Austin"}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(draft, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newTravelSchema(), nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, nil).Once()
		mockApps.On("Update", mock.MatchedBy(func(a *store.Application) bool {
			var got map[string]interface{}
			return json.Unmarshal(a.Responses, &got) == nil &&
				assert.ObjectsAreEqual(map[string]interface{}{"first_name": "Ada"}, got)
		})).Return(nil).Once()
		mockApps.On("Submit", draft, "").Return(nil).Once()

		checkResponseCode(t, http.StatusOK, submit(t, app, user))

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("does not rewrite a draft without travel answers", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		draft := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusDraft,
			Responses: json.RawMessage(`{"first_name":"Ada"}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(draft, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newTravelSchema(), nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, nil).Once()
		mockApps.On("Submit", draft, "").Return(nil).Once()

		checkResponseCode(t, http.StatusOK, submit(t, app, user))

		mockApps.AssertNotCalled(t, "Update", mock.Anything)
		mockApps.AssertExpectations(t)
	})

	t.Run("returns 500 and does not submit when stripping fails to save", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		draft := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusDraft,
			Responses: json.RawMessage(`{"first_name":"Ada","travel_reimbursement":false}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(draft, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newTravelSchema(), nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, nil).Once()
		mockApps.On("Update", mock.Anything).Return(assert.AnError).Once()

		checkResponseCode(t, http.StatusInternalServerError, submit(t, app, user))

		mockApps.AssertNotCalled(t, "Submit", mock.Anything, mock.Anything)
	})
}

func TestTravelApplicationsEnabledSettings(t *testing.T) {
	t.Run("should return whether travel applications are open", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTravelApplicationsEnabled))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelApplicationsEnabledResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.False(t, envelope.Data.Enabled)
	})

	t.Run("should return 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetTravelApplicationsEnabled").Return(false, assert.AnError).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTravelApplicationsEnabled))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("should close travel applications", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("SetTravelApplicationsEnabled", false).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"enabled":false}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTravelApplicationsEnabled))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelApplicationsEnabledResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.False(t, envelope.Data.Enabled)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for a malformed body", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"enabled":"no"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTravelApplicationsEnabled))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		mockSettings.AssertNotCalled(t, "SetTravelApplicationsEnabled", mock.Anything)
	})

	t.Run("should return 500 when the store fails to save", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("SetTravelApplicationsEnabled", true).Return(assert.AnError).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"enabled":true}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTravelApplicationsEnabled))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}
