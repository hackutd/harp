package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type BatchUpdateRolesPayload struct {
	UserIDs []string       `json:"user_ids" validate:"required,min=1,max=50,dive,uuid"`
	Role    store.UserRole `json:"role" validate:"required,oneof=hacker admin"`
}

type BatchUpdateRolesResponse struct {
	Users []*store.User `json:"users"`
}

// batchUpdateRolesHandler updates the role for a batch of users
//
//	@Summary		Batch update user roles (Super Admin)
//	@Description	Updates the role for up to 50 users. Cannot modify own role.
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		BatchUpdateRolesPayload	true	"User IDs and target role"
//	@Success		200		{object}	BatchUpdateRolesResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/users/role [patch]
func (app *application) batchUpdateRolesHandler(w http.ResponseWriter, r *http.Request) {
	var req BatchUpdateRolesPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	caller := getUserFromContext(r.Context())
	if caller == nil {
		app.internalServerError(w, r, errors.New("user not in context"))
		return
	}

	for _, id := range req.UserIDs {
		if id == caller.ID {
			app.badRequestResponse(w, r, errors.New("cannot modify your own role"))
			return
		}
	}

	users, err := app.store.Users.BatchUpdateRoles(r.Context(), req.UserIDs, req.Role)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if len(users) != len(req.UserIDs) {
		app.badRequestResponse(w, r, errors.New("one or more user IDs do not exist"))
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, BatchUpdateRolesResponse{Users: users}); err != nil {
		app.internalServerError(w, r, err)
	}
}
