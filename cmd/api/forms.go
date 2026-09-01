package main

import (
	"net/http"

	"github.com/hackutd/harp/internal/store"
)

type FormAvailability struct {
	Enabled bool   `json:"enabled"`
	DueDate string `json:"due_date,omitempty"`
}

type FormsOverviewResponse struct {
	Application FormAvailability           `json:"application"`
	RSVP        FormAvailability           `json:"rsvp"`
	Travel      FormAvailability           `json:"travel"`
	Stats       *store.FormOperationsStats `json:"stats"`
}

// getFormsOverview returns the lifecycle state and aggregate operational
// metrics for all participant forms in one request.
//
//	@Summary	Get forms operations overview (Super Admin)
//	@Tags		superadmin/forms
//	@Produce	json
//	@Success	200	{object}	FormsOverviewResponse
//	@Failure	401	{object}	object{error=string}
//	@Failure	403	{object}	object{error=string}
//	@Failure	500	{object}	object{error=string}
//	@Security	CookieAuth
//	@Router		/superadmin/forms/summary [get]
func (app *application) getFormsOverview(w http.ResponseWriter, r *http.Request) {
	stats, err := app.store.Application.GetFormOperationsStats(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	applicationsEnabled, err := app.store.Settings.GetApplicationsEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	rsvpEnabled, err := app.store.Settings.GetRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	travelEnabled, err := app.store.Settings.GetTravelRSVPEnabled(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	dueDate, err := app.store.Settings.GetApplicationDueDate(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	response := FormsOverviewResponse{
		Application: FormAvailability{Enabled: applicationsEnabled, DueDate: dueDate},
		RSVP:        FormAvailability{Enabled: rsvpEnabled},
		Travel:      FormAvailability{Enabled: travelEnabled},
		Stats:       stats,
	}
	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
