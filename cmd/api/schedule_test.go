package main

import (
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

// helper to build a chi router with a URL param for testing handlers that read chi.URLParam
func scheduleRouter(app *application) chi.Router {
	r := chi.NewRouter()
	r.Put("/{scheduleID}", app.updateScheduleHandler)
	r.Delete("/{scheduleID}", app.deleteScheduleHandler)
	return r
}

func TestListSchedule(t *testing.T) {
	t.Run("returns 200 with items", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)

		items := []store.ScheduleItem{
			{
				ID:        "item-1",
				EventName: "Opening Ceremony",
				StartTime: time.Date(2026, 3, 14, 10, 0, 0, 0, time.UTC),
				EndTime:   time.Date(2026, 3, 14, 11, 0, 0, 0, time.UTC),
				Tags:      store.StringArray{},
			},
		}
		mockSchedule.On("List").Return(items, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listScheduleHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScheduleListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Schedule, 1)

		mockSchedule.AssertExpectations(t)
	})
}

func TestCreateSchedule(t *testing.T) {
	t.Run("returns 201 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)

		mockSchedule.On("Create", mock.AnythingOfType("*store.ScheduleItem")).Return(nil).Once()

		body := `{"event_name":"Opening Ceremony","start_time":"2026-03-14T10:00:00Z","end_time":"2026-03-14T11:00:00Z","location":"Main Hall","tags":["ceremony"]}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduleHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var resp struct {
			Data ScheduleItemResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "Opening Ceremony", resp.Data.Schedule.EventName)

		mockSchedule.AssertExpectations(t)
	})

	t.Run("returns 400 with missing event_name", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"start_time":"2026-03-14T10:00:00Z","end_time":"2026-03-14T11:00:00Z"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduleHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateSchedule(t *testing.T) {
	t.Run("returns 200 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		r := scheduleRouter(app)

		mockSchedule.On("Update", mock.AnythingOfType("*store.ScheduleItem")).Return(nil).Once()

		body := `{"event_name":"Updated Ceremony","start_time":"2026-03-14T11:00:00Z","end_time":"2026-03-14T12:00:00Z","location":"Room B"}`
		req, err := http.NewRequest(http.MethodPut, "/item-1", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data ScheduleItemResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "Updated Ceremony", resp.Data.Schedule.EventName)

		mockSchedule.AssertExpectations(t)
	})

	t.Run("returns 404 when not found", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		r := scheduleRouter(app)

		mockSchedule.On("Update", mock.AnythingOfType("*store.ScheduleItem")).Return(store.ErrNotFound).Once()

		body := `{"event_name":"Updated Ceremony","start_time":"2026-03-14T11:00:00Z","end_time":"2026-03-14T12:00:00Z"}`
		req, err := http.NewRequest(http.MethodPut, "/nonexistent", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSchedule.AssertExpectations(t)
	})
}

func TestDeleteSchedule(t *testing.T) {
	t.Run("returns 204 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		r := scheduleRouter(app)

		mockSchedule.On("Delete", "item-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/item-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockSchedule.AssertExpectations(t)
	})

	t.Run("returns 404 when not found", func(t *testing.T) {
		app := newTestApplication(t)
		mockSchedule := app.store.Schedule.(*store.MockScheduleStore)
		r := scheduleRouter(app)

		mockSchedule.On("Delete", "nonexistent").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/nonexistent", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockSchedule.AssertExpectations(t)
	})
}
