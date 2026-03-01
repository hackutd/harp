package main

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type UserSearchResponse struct {
	Users      []store.UserListItem `json:"users"`
	TotalCount int                  `json:"total_count"`
}

type UpdateRolePayload struct {
	Role store.UserRole `json:"role" validate:"required,oneof=hacker admin super_admin"`
}

type UpdateRoleResponse struct {
	User *store.User `json:"user"`
}

// searchUsersHandler searches users by email or name
//
// @Summary		Search users (Super Admin)
// @Description	Searches users by email, first name, or last name using trigram matching
// @Tags			superadmin
// @Produce		json
// @Param			search	query		string	true	"Search query (min 2 chars)"
// @Param			limit	query		int		false	"Page size (default 20, max 100)"
// @Param			offset	query		int		false	"Offset (default 0)"
// @Success		200		{object}	UserSearchResponse
// @Failure		400		{object}	object{error=string}
// @Failure		401		{object}	object{error=string}
// @Failure		403		{object}	object{error=string}
// @Failure		500		{object}	object{error=string}
// @Security		CookieAuth
// @Router			/superadmin/users [get]
func (app *application) searchUsersHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	search := query.Get("search")
	if search == "" {
		app.badRequestResponse(w, r, errors.New("search parameter is required"))
		return
	}
	if len(search) < 2 {
		app.badRequestResponse(w, r, errors.New("search must be at least 2 characters"))
		return
	}
	if len(search) > 100 {
		app.badRequestResponse(w, r, errors.New("search must be at most 100 characters"))
		return
	}

	limit := 20
	if limitStr := query.Get("limit"); limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 || parsedLimit > 100 {
			app.badRequestResponse(w, r, errors.New("limit must be between 1 and 100"))
			return
		}
		limit = parsedLimit
	}

	offset := 0
	if offsetStr := query.Get("offset"); offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err != nil || parsedOffset < 0 {
			app.badRequestResponse(w, r, errors.New("offset must be a non-negative integer"))
			return
		}
		offset = parsedOffset
	}

	result, err := app.store.Users.Search(r.Context(), search, limit, offset)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, result); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateUserRoleHandler updates a user's role
//
// @Summary		Update user role (Super Admin)
// @Description	Updates the role of a user by their ID
// @Tags			superadmin
// @Accept			json
// @Produce		json
// @Param			userID	path		string				true	"User ID"
// @Param			role	body		UpdateRolePayload	true	"New role"
// @Success		200		{object}	UserResponse
// @Failure		400		{object}	object{error=string}
// @Failure		401		{object}	object{error=string}
// @Failure		403		{object}	object{error=string}
// @Failure		404		{object}	object{error=string}
// @Failure		500		{object}	object{error=string}
// @Security		CookieAuth
// @Router			/superadmin/users/{userID}/role [patch]
func (app *application) updateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	if userID == "" {
		app.badRequestResponse(w, r, errors.New("user ID is required"))
		return
	}

	var payload UpdateRolePayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	user, err := app.store.Users.UpdateRole(r.Context(), userID, payload.Role)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("user not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, UpdateRoleResponse{User: user}); err != nil {
		app.internalServerError(w, r, err)
	}
}
