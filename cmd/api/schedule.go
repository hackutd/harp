package main

import (
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
