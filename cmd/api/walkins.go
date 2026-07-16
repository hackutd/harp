package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type WalkInsResponse struct {
	Pending int            `json:"pending"`
	Total   int            `json:"total"`
	Queue   []store.WalkIn `json:"queue"`
}

type PromoteWalkInsPayload struct {
	Count int `json:"count" validate:"required,min=1"`
}

type PromoteWalkInsResponse struct {
	PromotedCount int          `json:"promoted_count"`
	Promoted      []store.User `json:"promoted"`
}

// getWalkInsHandler returns the current walk-in queue depth and pending entries
//
//	@Summary		Get walk-in queue (Super Admin)
//	@Description	Returns pending count, total count, and ordered list of un-promoted walk-in entries
//	@Tags			superadmin/walk-ins
//	@Produce		json
//	@Success		200	{object}	WalkInsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/walk-ins [get]
func (app *application) getWalkInsHandler(w http.ResponseWriter, r *http.Request) {
	pending, total, err := app.store.WalkIns.QueueDepth(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	queue, err := app.store.WalkIns.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, WalkInsResponse{
		Pending: pending,
		Total:   total,
		Queue:   queue,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// promoteWalkInsHandler promotes the next N walk-ins and sends acceptance emails
//
//	@Summary		Promote walk-ins (Super Admin)
//	@Description	Promotes the next N un-promoted walk-ins in FIFO order and sends acceptance emails
//	@Tags			superadmin/walk-ins
//	@Accept			json
//	@Produce		json
//	@Param			body	body		PromoteWalkInsPayload	true	"Number of walk-ins to promote"
//	@Success		200		{object}	PromoteWalkInsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/walk-ins/promote [post]
func (app *application) promoteWalkInsHandler(w http.ResponseWriter, r *http.Request) {
	var req PromoteWalkInsPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	admin := getUserFromContext(r.Context())
	if admin == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	promoted, err := app.store.WalkIns.PromoteNext(r.Context(), req.Count, admin.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	for _, u := range promoted {
		go func() {
			if err := app.mailer.SendWalkInAcceptedEmail(u.Email, u.ID); err != nil {
				app.logger.Errorw("failed to send walk-in accepted email", "error", err, "user_id", u.ID)
			}
		}()
	}

	if err := app.jsonResponse(w, http.StatusOK, PromoteWalkInsResponse{
		PromotedCount: len(promoted),
		Promoted:      promoted,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}
