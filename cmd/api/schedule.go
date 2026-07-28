package main

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type CreateSchedulePayload = SchedulePayload

type UpdateSchedulePayload = SchedulePayload

type SchedulePayload struct {
	EventName   string    `json:"event_name" validate:"required,min=1,max=200"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time" validate:"required"`
	EndTime     time.Time `json:"end_time" validate:"required"`
	Location    string    `json:"location"`
	Tags        []string  `json:"tags"`
}

type ScheduleListResponse struct {
	Schedule []store.ScheduleItem `json:"schedule"`
}

type ScheduleItemResponse struct {
	Schedule store.ScheduleItem `json:"schedule"`
}

// getAdminScheduleDateRange returns configured hackathon start/end dates (Admin)
//
//	@Summary		Get hackathon date range (Admin)
//	@Description	Returns configured hackathon start and end dates for schedule rendering
//	@Tags			admin/schedule
//	@Produce		json
//	@Success		200	{object}	HackathonDateRangeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/schedule/date-range [get]
func (app *application) getAdminScheduleDateRange(w http.ResponseWriter, r *http.Request) {
	dateRange, err := app.store.Settings.GetHackathonDateRange(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := HackathonDateRangeResponse{
		StartDate:  dateRange.StartDate,
		EndDate:    dateRange.EndDate,
		Configured: dateRange.StartDate != nil && dateRange.EndDate != nil,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getHackerScheduleHandler returns the full schedule for any authenticated user.
//
//	@Summary		Get schedule
//	@Description	Returns the full event schedule, ordered by start time ascending
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	ScheduleListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/schedule [get]
func (app *application) getHackerScheduleHandler(w http.ResponseWriter, r *http.Request) {
	app.listScheduleHandler(w, r)
}

// getHackerScheduleDateRange returns configured hackathon start/end dates.
//
//	@Summary		Get hackathon date range
//	@Description	Returns configured hackathon start and end dates so the hacker schedule can render one column per day
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	HackathonDateRangeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/schedule/date-range [get]
func (app *application) getHackerScheduleDateRange(w http.ResponseWriter, r *http.Request) {
	dateRange, err := app.store.Settings.GetHackathonDateRange(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := HackathonDateRangeResponse{
		StartDate:  dateRange.StartDate,
		EndDate:    dateRange.EndDate,
		Configured: dateRange.StartDate != nil && dateRange.EndDate != nil,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// listScheduleHandler returns all schedule items (Admin)
//
//	@Summary		List schedule (Admin)
//	@Description	Returns the full event schedule, ordered by start time ascending
//	@Tags			admin/schedule
//	@Produce		json
//	@Success		200	{object}	ScheduleListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/schedule [get]
func (app *application) listScheduleHandler(w http.ResponseWriter, r *http.Request) {
	items, err := app.store.Schedule.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScheduleListResponse{Schedule: items}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createScheduleHandler creates a new schedule item (Admin)
//
//	@Summary		Create schedule item (Admin)
//	@Description	Creates a new event in the schedule
//	@Tags			admin/schedule
//	@Accept			json
//	@Produce		json
//	@Param			schedule	body		CreateSchedulePayload	true	"Schedule item to create"
//	@Success		201			{object}	ScheduleItemResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/schedule [post]
func (app *application) createScheduleHandler(w http.ResponseWriter, r *http.Request) {
	var payload CreateSchedulePayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.validateSchedulePayloadAgainstConfiguredRange(r.Context(), payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	tags := payload.Tags
	if tags == nil {
		tags = []string{}
	}

	item := &store.ScheduleItem{
		EventName:   payload.EventName,
		Description: payload.Description,
		StartTime:   payload.StartTime,
		EndTime:     payload.EndTime,
		Location:    payload.Location,
		Tags:        store.StringArray(tags),
	}

	if err := app.store.Schedule.Create(r.Context(), item); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusCreated, ScheduleItemResponse{Schedule: *item}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateScheduleHandler updates an existing schedule item (Admin)
//
//	@Summary		Update schedule item (Admin)
//	@Description	Updates an existing event in the schedule
//	@Tags			admin/schedule
//	@Accept			json
//	@Produce		json
//	@Param			scheduleID	path		string					true	"Schedule item ID"
//	@Param			schedule	body		UpdateSchedulePayload	true	"Schedule item to update"
//	@Success		200			{object}	ScheduleItemResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/schedule/{scheduleID} [put]
func (app *application) updateScheduleHandler(w http.ResponseWriter, r *http.Request) {
	scheduleID := chi.URLParam(r, "scheduleID")

	var payload UpdateSchedulePayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.validateSchedulePayloadAgainstConfiguredRange(r.Context(), payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	tags := payload.Tags
	if tags == nil {
		tags = []string{}
	}

	item := &store.ScheduleItem{
		ID:          scheduleID,
		EventName:   payload.EventName,
		Description: payload.Description,
		StartTime:   payload.StartTime,
		EndTime:     payload.EndTime,
		Location:    payload.Location,
		Tags:        store.StringArray(tags),
	}

	if err := app.store.Schedule.Update(r.Context(), item); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ScheduleItemResponse{Schedule: *item}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteScheduleHandler deletes a schedule item (Admin)
//
//	@Summary		Delete schedule item (Admin)
//	@Description	Deletes an event from the schedule
//	@Tags			admin/schedule
//	@Param			scheduleID	path	string	true	"Schedule item ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/schedule/{scheduleID} [delete]
func (app *application) deleteScheduleHandler(w http.ResponseWriter, r *http.Request) {
	scheduleID := chi.URLParam(r, "scheduleID")

	if err := app.store.Schedule.Delete(r.Context(), scheduleID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (app *application) validateSchedulePayloadAgainstConfiguredRange(ctx context.Context, payload SchedulePayload) error {
	dateRange, err := app.store.Settings.GetHackathonDateRange(ctx)
	if err != nil {
		return err
	}

	if dateRange.StartDate == nil || dateRange.EndDate == nil {
		return errors.New("hackathon date range is not configured")
	}

	// Times are stored and compared as absolute UTC instants; the configured
	// range is a pair of calendar dates parsed as UTC midnight. The client
	// renders everything in the viewer's local timezone, so the server itself
	// does no timezone reasoning.
	startDate, err := time.Parse("2006-01-02", *dateRange.StartDate)
	if err != nil {
		return errors.New("invalid configured start_date")
	}

	endDate, err := time.Parse("2006-01-02", *dateRange.EndDate)
	if err != nil {
		return errors.New("invalid configured end_date")
	}

	if !payload.EndTime.After(payload.StartTime) {
		return errors.New("end_time must be after start_time")
	}

	// The grid renders each event within a single day, so cap the duration
	// instead of checking a timezone-specific calendar day.
	if payload.EndTime.Sub(payload.StartTime) > 24*time.Hour {
		return errors.New("schedule events cannot span multiple days")
	}

	// Allow the inclusive last day (+24h) plus a one-day buffer on each side so
	// an event authored near local midnight is never falsely rejected, whatever
	// the author's timezone (max offset ±14h < 24h). Still guards wildly-off dates.
	lowerBound := startDate.Add(-24 * time.Hour)
	upperBound := endDate.Add(48 * time.Hour)
	if payload.StartTime.Before(lowerBound) || payload.EndTime.After(upperBound) {
		return errors.New("event must be within configured hackathon date range")
	}

	return nil
}
