package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFormsOverview(t *testing.T) {
	app := newTestApplication(t)
	mockApplications := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	stats := &store.FormOperationsStats{
		Applications: store.ApplicationFormStats{
			Started:          120,
			Submitted:        100,
			AwaitingDecision: 20,
			Accepted:         60,
			CompletionRate:   83.33,
		},
		RSVP: store.RSVPFormStats{
			Eligible:     60,
			Pending:      10,
			Confirmed:    45,
			Declined:     5,
			ResponseRate: 83.33,
		},
		Travel: store.TravelFormStats{
			Requested:              30,
			Approved:               18,
			PeopleWithReceipts:     12,
			RequestedEstimateCents: 1200000,
			ApprovedAmountCents:    825000,
		},
	}

	mockApplications.On("GetFormOperationsStats").Return(stats, nil).Once()
	mockSettings.On("GetApplicationsEnabled").Return(true, nil).Once()
	mockSettings.On("GetRSVPEnabled").Return(true, nil).Once()
	mockSettings.On("GetTravelRSVPEnabled").Return(false, nil).Once()
	mockSettings.On("GetApplicationDueDate").Return("2026-10-01T05:00:00Z", nil).Once()

	req, err := http.NewRequest(http.MethodGet, "/", nil)
	require.NoError(t, err)
	req = setUserContext(req, newSuperAdminUser())

	rr := executeRequest(req, http.HandlerFunc(app.getFormsOverview))
	checkResponseCode(t, http.StatusOK, rr.Code)

	var body struct {
		Data FormsOverviewResponse `json:"data"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	assert.True(t, body.Data.Application.Enabled)
	assert.Equal(t, "2026-10-01T05:00:00Z", body.Data.Application.DueDate)
	assert.False(t, body.Data.Travel.Enabled)
	assert.EqualValues(t, 825000, body.Data.Stats.Travel.ApprovedAmountCents)
	assert.EqualValues(t, 12, body.Data.Stats.Travel.PeopleWithReceipts)

	mockApplications.AssertExpectations(t)
	mockSettings.AssertExpectations(t)
}
