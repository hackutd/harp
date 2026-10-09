package main

import (
	"context"
	"net/http"
	"time"
)

type PriorityDeadlineResponse struct {
	// Deadline is the instant an application must have been submitted by to
	// count as priority, in the offset it was saved with. Null when unset.
	Deadline *time.Time `json:"deadline"`
}

type PriorityDeadlineStatsResponse struct {
	Deadline *time.Time `json:"deadline"`
	// Counts is how many applications were submitted by the deadline, keyed by
	// current status. Empty when no deadline is set.
	Counts map[string]int `json:"counts"`
}

type SetPriorityDeadlinePayload struct {
	// Deadline is an RFC 3339 timestamp; null clears it.
	Deadline *time.Time `json:"deadline"`
}

// getPriorityDeadline returns the priority deadline
//
//	@Summary		Get priority deadline (Admin)
//	@Description	Returns the instant an application must have been submitted by to count as priority, or null when none is set.
//	@Tags			admin/settings
//	@Produce		json
//	@Success		200	{object}	PriorityDeadlineResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/settings/priority-deadline [get]
func (app *application) getPriorityDeadline(w http.ResponseWriter, r *http.Request) {
	deadline, err := app.store.Settings.GetPriorityDeadline(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, PriorityDeadlineResponse{Deadline: deadline}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getPriorityDeadlineStats returns the priority deadline with the applications it covers
//
//	@Summary		Get priority deadline stats (Super Admin)
//	@Description	Returns the priority deadline and how many applications were submitted by it, by current status, so the cutoff can be checked before decisions are released against it.
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	PriorityDeadlineStatsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/priority-deadline [get]
func (app *application) getPriorityDeadlineStats(w http.ResponseWriter, r *http.Request) {
	deadline, err := app.store.Settings.GetPriorityDeadline(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.writePriorityDeadlineStats(w, r, deadline)
}

// setPriorityDeadline updates the priority deadline
//
//	@Summary		Set priority deadline (Super Admin)
//	@Description	Sets the instant an application must have been submitted by to count as priority (RFC 3339, kept in the offset it is sent with), or clears it with null. Returns the applications the new deadline covers.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		SetPriorityDeadlinePayload	true	"Priority deadline"
//	@Success		200		{object}	PriorityDeadlineStatsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/priority-deadline [put]
func (app *application) setPriorityDeadline(w http.ResponseWriter, r *http.Request) {
	var req SetPriorityDeadlinePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.Settings.SetPriorityDeadline(r.Context(), req.Deadline); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.writePriorityDeadlineStats(w, r, req.Deadline)
}

func (app *application) writePriorityDeadlineStats(w http.ResponseWriter, r *http.Request, deadline *time.Time) {
	counts, err := app.priorityCounts(r.Context(), deadline)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, PriorityDeadlineStatsResponse{Deadline: deadline, Counts: counts}); err != nil {
		app.internalServerError(w, r, err)
	}
}

func (app *application) priorityCounts(ctx context.Context, deadline *time.Time) (map[string]int, error) {
	counts := map[string]int{}
	if deadline == nil {
		return counts, nil
	}

	byStatus, err := app.store.Application.CountSubmittedByStatus(ctx, *deadline)
	if err != nil {
		return nil, err
	}
	for status, count := range byStatus {
		counts[string(status)] = count
	}
	return counts, nil
}
