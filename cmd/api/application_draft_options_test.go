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

func TestApplicationDraftSurvivesRemovedOption(t *testing.T) {
	app := newTestApplication(t)
	user := newTestUser()
	draft := &store.Application{ID: "draft", UserID: user.ID, Status: store.StatusDraft,
		Responses: json.RawMessage(`{"level_of_study":"Senior","first_name":"Before"}`)}
	schema := []store.ApplicationSchemaField{
		{ID: "level_of_study", Type: "select", Required: true, Options: []string{"Undergraduate", "Graduate"}},
		{ID: "first_name", Type: "text", Required: true},
	}
	apps := app.store.Application.(*store.MockApplicationStore)
	settings := app.store.Settings.(*store.MockSettingsStore)
	apps.On("GetByUserID", user.ID).Return(draft, nil).Times(4)
	settings.On("GetApplicationSchema").Return(schema, nil).Times(4)
	apps.On("Update", mock.AnythingOfType("*store.Application")).Return(nil).Twice()
	app.store.Scans.(*store.MockScansStore).On("GetTotalPointsByUserID", user.ID).Return(0, nil).Twice()

	patch := func(choice string) {
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(`{"responses":{"level_of_study":"`+choice+`","first_name":"After"}}`))
		require.NoError(t, err)
		rr := executeRequest(setUserContext(req, user), http.HandlerFunc(app.updateApplicationHandler))
		require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
		var envelope struct {
			Data ApplicationWithSchema `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, schema, envelope.Data.ApplicationSchema)
		assert.JSONEq(t, `{"level_of_study":"`+choice+`","first_name":"After"}`, string(envelope.Data.Responses))
	}
	patch("Senior")
	req, err := http.NewRequest(http.MethodPost, "/", nil)
	require.NoError(t, err)
	rr := executeRequest(setUserContext(req, user), http.HandlerFunc(app.submitApplicationHandler))
	require.Equal(t, http.StatusBadRequest, rr.Code)
	var failure struct {
		Fields []string `json:"fields"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &failure))
	assert.Equal(t, []string{"level_of_study"}, failure.Fields)
	apps.AssertNotCalled(t, "Submit", mock.Anything, mock.Anything)

	patch("Undergraduate")
	apps.On("Submit", draft, "").Return(nil).Once()
	rr = executeRequest(setUserContext(req, user), http.HandlerFunc(app.submitApplicationHandler))
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	apps.AssertExpectations(t)
	settings.AssertExpectations(t)
}

func TestDraftAndFinalResponseValidation(t *testing.T) {
	for _, tc := range []struct {
		name                       string
		field                      store.ApplicationSchemaField
		value                      interface{}
		draftInvalid, finalInvalid bool
	}{
		{"removed select", store.ApplicationSchemaField{Type: "select", Options: []string{"Current"}}, "Old", false, true},
		{"current select", store.ApplicationSchemaField{Type: "select", Options: []string{"Current"}}, "Current", false, false},
		{"exact select", store.ApplicationSchemaField{Type: "select", Options: []string{"Current"}}, "current", false, true},
		{"unrestricted select", store.ApplicationSchemaField{Type: "select"}, "Old", false, false},
		{"wrong select type", store.ApplicationSchemaField{Type: "select"}, float64(1), true, true},
		{"removed multi choice", store.ApplicationSchemaField{Type: "multi_select", Options: []string{"Current"}}, []interface{}{"Current", "Old"}, false, true},
		{"wrong multi type", store.ApplicationSchemaField{Type: "multi_select"}, "Current", true, true},
		{"wrong multi item", store.ApplicationSchemaField{Type: "multi_select"}, []interface{}{"Current", float64(2)}, true, true},
		{"unrestricted multi", store.ApplicationSchemaField{Type: "multi_select"}, []interface{}{"Old"}, false, false},
		{"optional blank", store.ApplicationSchemaField{Type: "select", Options: []string{"Current"}}, " ", false, false},
		{"required blank", store.ApplicationSchemaField{Type: "select", Required: true}, "", false, true},
		{"required missing", store.ApplicationSchemaField{Type: "select", Required: true}, nil, false, true},
		{"required empty multi", store.ApplicationSchemaField{Type: "multi_select", Required: true}, []interface{}{}, false, true},
		{"required checkbox", store.ApplicationSchemaField{Type: "checkbox", Required: true}, false, false, true},
		{"numeric limit", store.ApplicationSchemaField{Type: "number", Validation: map[string]interface{}{"max": float64(10)}}, float64(20), true, true},
		{"length limit", store.ApplicationSchemaField{Type: "text", Validation: map[string]interface{}{"maxLength": float64(2)}}, "Long", true, true},
		{"hidden obsolete choice", store.ApplicationSchemaField{Type: "select", Options: []string{"Current"}, Validation: map[string]interface{}{"show_if": "enabled"}}, "Old", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tc.field.ID = "answer"
			schema := []store.ApplicationSchemaField{tc.field}
			responses := map[string]interface{}{"answer": tc.value}
			assert.Equal(t, tc.draftInvalid, len(validateResponses(schema, responses, draftValidation)) > 0)
			assert.Equal(t, tc.finalInvalid, len(validateResponses(schema, responses, finalValidation)) > 0)
		})
	}
}
