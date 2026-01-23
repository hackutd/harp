package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

// getOrCreateApplicationHandler returns the user's application, creating a draft if none exists
//
//	@Summary		Get or create application
//	@Description	Returns the authenticated user's hackathon application. If no application exists, creates a new draft application.
//	@Tags			applications
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	store.Application
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/applications/me [get]
func (app *application) getOrCreateApplicationHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
		return
	}

	application, err := app.store.Application.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Create new draft application (app not found)
			application = &store.Application{UserID: user.ID}
			if err := app.store.Application.Create(r.Context(), application); err != nil {
				if errors.Is(err, store.ErrConflict) {
					// Race condition: another request created the application -> fetch it
					application, err = app.store.Application.GetByUserID(r.Context(), user.ID)
					if err != nil {
						app.internalServerError(w, r, err)
						return
					}
				} else {
					app.internalServerError(w, r, err)
					return
				}
			}
		} else {
			app.internalServerError(w, r, err)
			return
		}
	}

	if err := app.jsonResponse(w, http.StatusOK, application); err != nil {
		app.internalServerError(w, r, err)
	}
}

func (app *application) updateApplicationHandler(w http.ResponseWriter, r *http.Request) {

}

func (app *application) submitApplicationHandler(w http.ResponseWriter, r *http.Request) {

}
