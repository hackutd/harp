package main

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type ScheduledNotificationPayload struct {
	Title       string    `json:"title" validate:"required,min=1,max=100"`
	Body        string    `json:"body" validate:"required,min=1,max=300"`
	URL         *string   `json:"url"`
	TargetRole  *string   `json:"target_role" validate:"omitempty,oneof=hacker admin super_admin"`
	ScheduledAt time.Time `json:"scheduled_at" validate:"required"`
}

const scheduledNotificationMinLead = time.Minute

// GenerateScheduleNotificationsPayload configures reminder generation from the schedule.
type GenerateScheduleNotificationsPayload struct {
	// LeadMinutes is how many minutes before each event the reminder should fire.
	LeadMinutes int     `json:"lead_minutes" validate:"required,min=1,max=1440"`
	TargetRole  *string `json:"target_role" validate:"omitempty,oneof=hacker admin super_admin"`
}

type ScheduledNotificationListResponse struct {
	Notifications []store.ScheduledNotification `json:"notifications"`
}

// listScheduledNotificationsHandler returns all scheduled notifications.
//
//	@Summary		List scheduled notifications (Super Admin)
//	@Description	Returns all scheduled notifications ordered by scheduled time descending
//	@Tags			superadmin/notifications
//	@Produce		json
//	@Success		200	{object}	ScheduledNotificationListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/notifications [get]
func (app *application) listScheduledNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	notifications, err := app.store.ScheduledNotifications.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScheduledNotificationListResponse{Notifications: notifications}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createScheduledNotificationHandler schedules a new notification.
//
//	@Summary		Create scheduled notification (Super Admin)
//	@Description	Schedules a push notification for delivery at the specified time
//	@Tags			superadmin/notifications
//	@Accept			json
//	@Produce		json
//	@Param			notification	body		ScheduledNotificationPayload	true	"Notification to schedule"
//	@Success		201				{object}	store.ScheduledNotification
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/notifications [post]
func (app *application) createScheduledNotificationHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var payload ScheduledNotificationPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := prepareScheduledNotificationPayload(&payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	n := &store.ScheduledNotification{
		Title:       payload.Title,
		Body:        payload.Body,
		URL:         payload.URL,
		TargetRole:  toUserRolePtr(payload.TargetRole),
		ScheduledAt: payload.ScheduledAt,
		CreatedBy:   user.ID,
	}

	if err := app.store.ScheduledNotifications.Create(r.Context(), n); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, n); err != nil {
		app.internalServerError(w, r, err)
	}
}

// generateScheduleNotificationsHandler builds reminder notifications from the schedule.
//
//	@Summary		Generate notifications from schedule (Super Admin)
//	@Description	Creates a reminder notification for each schedule event, scheduled the configured number of minutes before the event start time. Re-running replaces any pending schedule-generated reminders so the latest schedule and lead time are used; reminders whose send time has already passed are skipped.
//	@Tags			superadmin/notifications
//	@Accept			json
//	@Produce		json
//	@Param			config	body		GenerateScheduleNotificationsPayload	true	"Reminder generation config"
//	@Success		201		{object}	store.ScheduleNotificationGenerationResult
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/notifications/from-schedule [post]
func (app *application) generateScheduleNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var payload GenerateScheduleNotificationsPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	lead := time.Duration(payload.LeadMinutes) * time.Minute

	result, err := app.store.ScheduledNotifications.GenerateFromSchedule(
		r.Context(), lead, toUserRolePtr(payload.TargetRole), user.ID, time.Now(),
	)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, result); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateScheduledNotificationHandler updates a pending scheduled notification.
//
//	@Summary		Update scheduled notification (Super Admin)
//	@Description	Updates a pending notification. Returns 409 if already sent.
//	@Tags			superadmin/notifications
//	@Accept			json
//	@Produce		json
//	@Param			notificationID	path		string							true	"Notification ID"
//	@Param			notification	body		ScheduledNotificationPayload	true	"Notification updates"
//	@Success		200				{object}	store.ScheduledNotification
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		403				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		409				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/notifications/{notificationID} [patch]
func (app *application) updateScheduledNotificationHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "notificationID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing notification ID"))
		return
	}

	var payload ScheduledNotificationPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := prepareScheduledNotificationPayload(&payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	n := &store.ScheduledNotification{
		ID:          id,
		Title:       payload.Title,
		Body:        payload.Body,
		URL:         payload.URL,
		TargetRole:  toUserRolePtr(payload.TargetRole),
		ScheduledAt: payload.ScheduledAt,
	}

	if err := app.store.ScheduledNotifications.Update(r.Context(), n); err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("notification not found"))
			return
		case errors.Is(err, store.ErrConflict):
			app.conflictResponse(w, r, errors.New("notification already sent"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, n); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteScheduledNotificationHandler deletes a pending scheduled notification.
//
//	@Summary		Delete scheduled notification (Super Admin)
//	@Description	Deletes a pending notification. Returns 409 if already sent.
//	@Tags			superadmin/notifications
//	@Param			notificationID	path	string	true	"Notification ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		409	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/notifications/{notificationID} [delete]
func (app *application) deleteScheduledNotificationHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "notificationID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing notification ID"))
		return
	}

	if err := app.store.ScheduledNotifications.Delete(r.Context(), id); err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("notification not found"))
			return
		case errors.Is(err, store.ErrConflict):
			app.conflictResponse(w, r, errors.New("notification already sent"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func toUserRolePtr(s *string) *store.UserRole {
	if s == nil || *s == "" {
		return nil
	}
	r := store.UserRole(*s)
	return &r
}

func prepareScheduledNotificationPayload(payload *ScheduledNotificationPayload) error {
	payload.Title = strings.TrimSpace(payload.Title)
	payload.Body = strings.TrimSpace(payload.Body)

	normalizedURL, err := normalizeScheduledNotificationURL(payload.URL)
	if err != nil {
		return err
	}
	payload.URL = normalizedURL

	if err := Validate.Struct(*payload); err != nil {
		return err
	}

	if payload.ScheduledAt.Before(time.Now().Add(scheduledNotificationMinLead)) {
		return errors.New("scheduled_at must be at least 1 minute in the future")
	}

	return nil
}

func normalizeScheduledNotificationURL(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return nil, nil
	}

	if strings.Contains(trimmed, "\\") ||
		strings.HasPrefix(trimmed, "//") {
		return nil, errors.New("url must be a same-origin path")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, errors.New("url must be a valid same-origin path")
	}

	if parsed.IsAbs() || parsed.Host != "" || parsed.Path == "" || !strings.HasPrefix(parsed.Path, "/") {
		return nil, errors.New("url must be a same-origin path")
	}

	normalized := parsed.String()
	return &normalized, nil
}
