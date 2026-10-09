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

// newHiddenSchema returns a schema where a required question has been hidden
// after applicants started submitting, with a follow-up that only shows when
// it is answered a certain way, plus a question that stays visible.
func newHiddenSchema() []store.ApplicationSchemaField {
	return []store.ApplicationSchemaField{
		{ID: "first_name", Type: "text", Label: "First Name", Required: true},
		{
			ID: "interview_opt_in", Type: "select", Label: "On-site interviews?", Required: true, Hidden: true,
			Options: []string{"Yes", "No"},
		},
		{
			ID: "interview_ack", Type: "checkbox", Label: "I understand",
			Validation: map[string]interface{}{"show_if": "interview_opt_in=Yes", "required_if": "interview_opt_in=Yes"},
		},
		{
			ID: "interview_note", Type: "text", Label: "Anything else?",
			Validation: map[string]interface{}{"show_if": "interview_ack"},
		},
	}
}

func TestHiddenFieldIDs(t *testing.T) {
	t.Run("returns hidden fields and everything conditioned on them, transitively", func(t *testing.T) {
		ids := hiddenFieldIDs(newHiddenSchema())
		assert.Equal(t, map[string]bool{"interview_opt_in": true, "interview_ack": true, "interview_note": true}, ids)
	})

	t.Run("returns nothing when no field is hidden", func(t *testing.T) {
		assert.Empty(t, hiddenFieldIDs(newTravelSchema()))
	})

	t.Run("keeps a visible field whose controller is not hidden", func(t *testing.T) {
		schema := []store.ApplicationSchemaField{
			{ID: "a", Type: "checkbox", Hidden: true},
			{ID: "b", Type: "checkbox"},
			{ID: "c", Type: "text", Validation: map[string]interface{}{"show_if": "b"}},
		}
		assert.Equal(t, map[string]bool{"a": true}, hiddenFieldIDs(schema))
	})
}

func TestApplicantFields(t *testing.T) {
	t.Run("withholds hidden fields and their dependents", func(t *testing.T) {
		visible, withheld := applicantFields(newHiddenSchema())
		assert.Equal(t, []string{"first_name"}, schemaIDs(visible))
		assert.Equal(t, map[string]bool{"interview_opt_in": true, "interview_ack": true, "interview_note": true}, withheld)
	})

	t.Run("returns the schema untouched when nothing is hidden", func(t *testing.T) {
		schema := newTravelSchema()
		visible, withheld := applicantFields(schema)
		assert.Equal(t, schemaIDs(schema), schemaIDs(visible))
		assert.Nil(t, withheld)
	})
}

func TestApplicantSchemaWithHiddenFields(t *testing.T) {
	t.Run("withholds hidden fields from the hacker application", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(&store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newHiddenSchema(), nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, []string{"first_name"}, schemaIDs(envelope.Data.ApplicationSchema))
		mockSettings.AssertNotCalled(t, "GetTravelApplicationsEnabled")
	})

	t.Run("hides the travel questions when the opt-in itself is hidden, without reading the setting", func(t *testing.T) {
		schema := newTravelSchema()
		schema[1].Hidden = true

		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(&store.Application{ID: "app-1", UserID: user.ID, Status: store.StatusDraft}, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(schema, nil).Once()
		mockSettings.On("GetTravelApplicationsEnabled").Return(true, nil).Maybe()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, []string{"first_name"}, schemaIDs(envelope.Data.ApplicationSchema))
	})

	t.Run("keeps hidden questions a submitted application answered", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		submitted := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted,
			Responses: json.RawMessage(`{"first_name":"Ada","interview_opt_in":"Yes","interview_ack":true}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(submitted, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newHiddenSchema(), nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, []string{"first_name", "interview_opt_in", "interview_ack"}, schemaIDs(envelope.Data.ApplicationSchema))
	})

	t.Run("leaves hidden questions out of a submitted application that never answered them", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockScans := app.store.Scans.(*store.MockScansStore)
		user := newTestUser()

		submitted := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusSubmitted,
			Responses: json.RawMessage(`{"first_name":"Ada"}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(submitted, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newHiddenSchema(), nil).Once()
		mockScans.On("GetTotalPointsByUserID", user.ID).Return(0, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getOrCreateApplicationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, []string{"first_name"}, schemaIDs(envelope.Data.ApplicationSchema))
	})

	t.Run("admins still get the full schema", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetApplicationSchema").Return(newHiddenSchema(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getApplicationSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationSchemaResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, schemaIDs(newHiddenSchema()), schemaIDs(envelope.Data.Fields))
		assert.True(t, envelope.Data.Fields[1].Hidden)
	})
}

func TestSubmitApplicationWithHiddenFields(t *testing.T) {
	t.Run("submits without the hidden required answer and drops it from the draft", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		draft := &store.Application{
			ID: "app-1", UserID: user.ID, Status: store.StatusDraft,
			Responses: json.RawMessage(`{"first_name":"Ada","interview_opt_in":"Yes"}`),
		}
		mockApps.On("GetByUserID", user.ID).Return(draft, nil).Once()
		mockSettings.On("GetApplicationSchema").Return(newHiddenSchema(), nil).Once()
		mockApps.On("Update", mock.MatchedBy(func(a *store.Application) bool {
			var got map[string]interface{}
			return json.Unmarshal(a.Responses, &got) == nil &&
				assert.ObjectsAreEqual(map[string]interface{}{"first_name": "Ada"}, got)
		})).Return(nil).Once()
		mockApps.On("Submit", draft, "").Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		checkResponseCode(t, http.StatusOK, executeRequest(req, http.HandlerFunc(app.submitApplicationHandler)).Code)
		mockApps.AssertExpectations(t)
	})
}

func TestSchemaContractWithHiddenField(t *testing.T) {
	t.Run("saves a hidden travel opt-in and warns that travel review is off", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateApplicationSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"` + travelOptInFieldID + `","type":"checkbox","label":"Travel","hidden":true,"display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationSchemaResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, []string{applicationSchemaContracts[0].HiddenWarning}, envelope.Data.Warnings)
		assert.True(t, envelope.Data.Fields[0].Hidden)
	})
}

func TestRSVPSchemaWithHiddenFields(t *testing.T) {
	t.Run("does not require a hidden RSVP question", func(t *testing.T) {
		app := newTestApplication(t)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(newAcceptedApplication(user.ID), nil).Once()
		mockSettings.On("GetRSVPEnabled").Return(true, nil).Maybe()
		mockSettings.On("GetRSVPSchema").Return([]store.ApplicationSchemaField{
			{ID: "shirt", Type: "text", Label: "Shirt size", Required: true},
			{ID: "dietary", Type: "text", Label: "Dietary", Required: true, Hidden: true},
		}, nil).Once()
		mockApps.On("SubmitRSVP", mock.AnythingOfType("*store.Application")).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"status":"confirmed","responses":{"shirt":"M"}}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.submitMyRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		mockApps.AssertExpectations(t)
	})
}
