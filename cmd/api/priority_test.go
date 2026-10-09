package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestPriorityDeadline(t *testing.T) {
	deadline := time.Date(2026, 10, 3, 23, 59, 59, 999_000_000, time.FixedZone("CDT", -5*60*60))

	t.Run("admins read the deadline", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetPriorityDeadline").Return(&deadline, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getPriorityDeadline))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data struct {
				Deadline string `json:"deadline"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, "2026-10-03T23:59:59.999-05:00", envelope.Data.Deadline)
	})

	t.Run("reads null when unset", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetPriorityDeadline").Return(nil, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getPriorityDeadline))
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"data":{"deadline":null}}`, rr.Body.String())
	})

	t.Run("saving returns the applications the deadline covers", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings.On("SetPriorityDeadline", mock.MatchedBy(func(d *time.Time) bool {
			return d != nil && d.Equal(deadline)
		})).Return(nil).Once()
		mockApps.On("CountSubmittedByStatus", mock.MatchedBy(func(d time.Time) bool {
			return d.Equal(deadline)
		})).Return(map[store.ApplicationStatus]int{
			store.StatusSubmitted: 1063,
			store.StatusAccepted:  576,
		}, nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"deadline":"2026-10-03T23:59:59.999-05:00"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPriorityDeadline))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data PriorityDeadlineStatsResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, map[string]int{"submitted": 1063, "accepted": 576}, envelope.Data.Counts)
		mockSettings.AssertExpectations(t)
	})

	t.Run("clearing skips the count", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockApps := app.store.Application.(*store.MockApplicationStore)
		mockSettings.On("SetPriorityDeadline", (*time.Time)(nil)).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"deadline":null}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPriorityDeadline))
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"data":{"deadline":null,"counts":{}}}`, rr.Body.String())
		mockApps.AssertNotCalled(t, "CountSubmittedByStatus", mock.Anything)
	})

	t.Run("rejects a deadline that is not a timestamp", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"deadline":"2026-10-03"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setPriorityDeadline))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}
