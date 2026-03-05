package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPublicSchedule(t *testing.T) {
	t.Run("returns 401 without API key", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("returns 401 with wrong API key", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "wrong-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("returns 200 with schedule items", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		mux := app.mount()

		items := []store.ScheduleItem{
			{
				ID:        "item-1",
				EventName: "Opening Ceremony",
				StartTime: time.Date(2026, 3, 14, 10, 0, 0, 0, time.UTC),
				EndTime:   time.Date(2026, 3, 14, 11, 0, 0, 0, time.UTC),
				Location:  "Main Hall",
				Tags:      store.StringArray{"ceremony"},
			},
			{
				ID:        "item-2",
				EventName: "Hacking Begins",
				StartTime: time.Date(2026, 3, 14, 12, 0, 0, 0, time.UTC),
				EndTime:   time.Date(2026, 3, 14, 13, 0, 0, 0, time.UTC),
				Tags:      store.StringArray{},
			},
		}

		mockSchedule.On("List").Return(items, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScheduleListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Schedule, 2)
		assert.Equal(t, "Opening Ceremony", body.Data.Schedule[0].EventName)

		mockSchedule.AssertExpectations(t)
	})

	t.Run("returns 200 with empty array", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		mux := app.mount()

		mockSchedule.On("List").Return([]store.ScheduleItem{}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScheduleListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Schedule, 0)

		mockSchedule.AssertExpectations(t)
	})

	t.Run("returns 500 on store error", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		mux := app.mount()

		mockSchedule.On("List").Return(nil, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodGet, "/v1/public/schedule", nil)
		require.NoError(t, err)
		req.Header.Set("X-API-Key", "test-api-key")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockSchedule.AssertExpectations(t)
	})
}
