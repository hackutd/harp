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

// The schema editors are the only way these bindings can break, so the guard
// lives on the update handlers: an unusable binding is refused outright, while
// dropping the field is allowed and reported back as a warning.
func TestApplicationSchemaContract(t *testing.T) {
	t.Run("should reject a travel opt-in field that is no longer a checkbox", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"fields":[{"id":"` + travelOptInFieldID + `","type":"text","label":"Travel","display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateApplicationSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&errBody))
		assert.Contains(t, errBody.Error, "must stay of type \"checkbox\"")
	})

	t.Run("should save a schema that keeps the travel opt-in checkbox", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateApplicationSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"` + travelOptInFieldID + `","type":"checkbox","label":"Travel","display_order":0,"section_order":0}]}`
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
		assert.Empty(t, envelope.Data.Warnings)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should warn when the travel opt-in checkbox is removed", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateApplicationSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"first_name","type":"text","label":"First Name","display_order":0,"section_order":0}]}`
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
		require.Len(t, envelope.Data.Warnings, 1)
		assert.Contains(t, envelope.Data.Warnings[0], travelOptInFieldID)

		mockSettings.AssertExpectations(t)
	})
}

func TestTravelRSVPSchemaContract(t *testing.T) {
	t.Run("should reject a travel mode field that dropped the receipt option", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"fields":[{"id":"` + travelModeFieldID + `","type":"select","label":"Mode","options":["Driving","Plane"],"display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateTravelRSVPSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&errBody))
		assert.Contains(t, errBody.Error, travelModeFlying)
	})

	t.Run("should warn when the travel mode field is removed", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateTravelRSVPSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"travel_notes","type":"textarea","label":"Notes","display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateTravelRSVPSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelRSVPSchemaResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		require.Len(t, envelope.Data.Warnings, 1)
		assert.Contains(t, envelope.Data.Warnings[0], travelModeFieldID)

		mockSettings.AssertExpectations(t)
	})
}

func TestGetSchemaContract(t *testing.T) {
	app := newTestApplication(t)

	req, err := http.NewRequest(http.MethodGet, "/", nil)
	require.NoError(t, err)
	req = setUserContext(req, newSuperAdminUser())

	rr := executeRequest(req, http.HandlerFunc(app.getSchemaContract))
	checkResponseCode(t, http.StatusOK, rr.Code)

	var envelope struct {
		Data SchemaContractResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
	require.Len(t, envelope.Data.ApplicationSchema, 1)
	assert.Equal(t, travelOptInFieldID, envelope.Data.ApplicationSchema[0].FieldID)
	require.Len(t, envelope.Data.TravelRSVPSchema, 1)
	assert.Equal(t, []string{travelModeFlying}, envelope.Data.TravelRSVPSchema[0].RequiredOptions)
}

func TestSchemaContractFieldID(t *testing.T) {
	fields := []store.ApplicationSchemaField{{ID: travelOptInFieldID, Type: "checkbox"}}

	assert.Equal(t, travelOptInFieldID, schemaContractFieldID(fields, travelOptInFieldID))
	assert.Empty(t, schemaContractFieldID(nil, travelOptInFieldID))
}
