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

func withNotificationRouteParam(req *http.Request, id string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("notificationID", id)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func newTestNotification(id string) store.ScheduledNotification {
	return store.ScheduledNotification{
		ID:          id,
		Title:       "Applications closing soon",
		Body:        "Submit your application before midnight",
		ScheduledAt: time.Now().Add(time.Hour),
		CreatedBy:   "superadmin-1",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func TestListScheduledNotifications(t *testing.T) {
	app := newTestApplication(t)
	mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

	t.Run("returns all notifications", func(t *testing.T) {
		notifications := []store.ScheduledNotification{
			newTestNotification("n-1"),
			newTestNotification("n-2"),
		}
		mockNotifs.On("List").Return(notifications, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listScheduledNotificationsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ScheduledNotificationListResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Notifications, 2)

		mockNotifs.AssertExpectations(t)
	})
}

func TestCreateScheduledNotification(t *testing.T) {
	t.Run("creates a notification", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Create", mock.AnythingOfType("*store.ScheduledNotification")).Run(func(args mock.Arguments) {
			n := args.Get(0).(*store.ScheduledNotification)
			n.ID = "new-notif"
			assert.Equal(t, "superadmin-1", n.CreatedBy)
		}).Return(nil).Once()

		body := `{"title":"Test","body":"Hello","scheduled_at":"2030-01-01T00:00:00Z","target_role":"hacker"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var respBody struct {
			Data store.ScheduledNotification `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, "new-notif", respBody.Data.ID)
		require.NotNil(t, respBody.Data.TargetRole)
		assert.Equal(t, store.RoleHacker, *respBody.Data.TargetRole)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("normalizes app-relative URL and trims text", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Create", mock.AnythingOfType("*store.ScheduledNotification")).Run(func(args mock.Arguments) {
			n := args.Get(0).(*store.ScheduledNotification)
			n.ID = "new-notif"
			assert.Equal(t, "Trimmed title", n.Title)
			assert.Equal(t, "Trimmed body", n.Body)
			require.NotNil(t, n.URL)
			assert.Equal(t, "/app/status?tab=next#review", *n.URL)
		}).Return(nil).Once()

		scheduledAt := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339Nano)
		body := `{"title":"  Trimmed title  ","body":"  Trimmed body  ","scheduled_at":"` + scheduledAt + `","url":"  /app/status?tab=next#review  "}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("rejects invalid target_role", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"title":"Test","body":"Hello","scheduled_at":"2030-01-01T00:00:00Z","target_role":"intern"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("rejects missing scheduled_at", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"title":"Test","body":"Hello"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("rejects external URL", func(t *testing.T) {
		app := newTestApplication(t)

		scheduledAt := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339Nano)
		body := `{"title":"Test","body":"Hello","scheduled_at":"` + scheduledAt + `","url":"https://example.com/app"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("rejects protocol-relative URL", func(t *testing.T) {
		app := newTestApplication(t)

		scheduledAt := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339Nano)
		body := `{"title":"Test","body":"Hello","scheduled_at":"` + scheduledAt + `","url":"//example.com/app"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("rejects schedules too close to now", func(t *testing.T) {
		app := newTestApplication(t)

		scheduledAt := time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339Nano)
		body := `{"title":"Test","body":"Hello","scheduled_at":"` + scheduledAt + `"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.createScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestUpdateScheduledNotification(t *testing.T) {
	t.Run("updates a pending notification", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Update", mock.AnythingOfType("*store.ScheduledNotification")).Return(nil).Once()

		body := `{"title":"Updated","body":"New body","scheduled_at":"2030-01-01T00:00:00Z"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "n-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateScheduledNotificationHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("returns 409 if already sent", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Update", mock.AnythingOfType("*store.ScheduledNotification")).Return(store.ErrConflict).Once()

		body := `{"title":"Updated","body":"New body","scheduled_at":"2030-01-01T00:00:00Z"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "n-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateScheduledNotificationHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("returns 404 if missing", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Update", mock.AnythingOfType("*store.ScheduledNotification")).Return(store.ErrNotFound).Once()

		body := `{"title":"Updated","body":"New body","scheduled_at":"2030-01-01T00:00:00Z"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "missing")

		rr := executeRequest(req, http.HandlerFunc(app.updateScheduledNotificationHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("rejects schedules too close to now", func(t *testing.T) {
		app := newTestApplication(t)

		scheduledAt := time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339Nano)
		body := `{"title":"Updated","body":"New body","scheduled_at":"` + scheduledAt + `"}`
		req, err := http.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "n-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateScheduledNotificationHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestDeleteScheduledNotification(t *testing.T) {
	t.Run("deletes a pending notification", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Delete", "n-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "n-1")

		rr := executeRequest(req, http.HandlerFunc(app.deleteScheduledNotificationHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockNotifs.AssertExpectations(t)
	})

	t.Run("returns 409 if already sent", func(t *testing.T) {
		app := newTestApplication(t)
		mockNotifs := app.store.ScheduledNotifications.(*store.MockScheduledNotificationsStore)

		mockNotifs.On("Delete", "n-1").Return(store.ErrConflict).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		req = withNotificationRouteParam(req, "n-1")

		rr := executeRequest(req, http.HandlerFunc(app.deleteScheduledNotificationHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockNotifs.AssertExpectations(t)
	})
}

func TestRequireRoleMiddleware_Notifications(t *testing.T) {
	t.Run("admin gets 403 on superadmin notification routes", func(t *testing.T) {
		app := newTestApplication(t)

		// Mount the role middleware directly with a handler that should never be called
		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			t.Error("handler should not be called")
		}))

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})
}
