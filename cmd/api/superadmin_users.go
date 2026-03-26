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

type AdminUserListItem struct {
	store.UserListItem
	ReviewAssignmentEnabled *bool `json:"review_assignment_enabled"`
}

type AdminUserListResponse struct {
	Users      []AdminUserListItem `json:"users"`
	NextCursor *string             `json:"next_cursor,omitempty"`
	PrevCursor *string             `json:"prev_cursor,omitempty"`
	HasMore    bool                `json:"has_more"`
}

type UpdateRolePayload struct {
	Role store.UserRole `json:"role" validate:"required,oneof=hacker admin super_admin"`
}

type UpdateRoleResponse struct {
	User *store.User `json:"user"`
}

// searchUsersHandler searches users by email or name
//
//	@Summary		Search users (Super Admin)
//	@Description	Searches users by email, first name, or last name using trigram matching
//	@Tags			superadmin/users
//	@Produce		json
//	@Param			search	query		string	true	"Search query (min 2 chars)"
//	@Param			limit	query		int		false	"Page size (default 20, max 100)"
//	@Param			offset	query		int		false	"Offset (default 0)"
//	@Success		200		{object}	UserSearchResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/users [get]
func (app *application) searchUsersHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Role-based listing mode
	roleParams := query["role"]
	if len(roleParams) > 0 {
		app.listUsersByRole(w, r, roleParams)
		return
	}

	// Search mode
	search := query.Get("search")
	if search == "" {
		app.badRequestResponse(w, r, errors.New("search or role parameter is required"))
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

func (app *application) listUsersByRole(w http.ResponseWriter, r *http.Request, roleParams []string) {
	query := r.URL.Query()

	validRoles := map[string]store.UserRole{
		"admin":       store.RoleAdmin,
		"super_admin": store.RoleSuperAdmin,
		"hacker":      store.RoleHacker,
	}

	roles := make([]store.UserRole, 0, len(roleParams))
	for _, rp := range roleParams {
		role, ok := validRoles[rp]
		if !ok {
			app.badRequestResponse(w, r, errors.New("invalid role: "+rp))
			return
		}
		roles = append(roles, role)
	}

	search := query.Get("search")
	if search != "" && len(search) < 2 {
		app.badRequestResponse(w, r, errors.New("search must be at least 2 characters"))
		return
	}
	if len(search) > 100 {
		app.badRequestResponse(w, r, errors.New("search must be at most 100 characters"))
		return
	}

	var userCursor *store.UserCursor
	if cursorStr := query.Get("cursor"); cursorStr != "" {
		decoded, err := store.DecodeUserCursor(cursorStr)
		if err != nil {
			app.badRequestResponse(w, r, errors.New("invalid cursor"))
			return
		}
		userCursor = decoded
	}

	direction := store.DirectionForward
	if dirStr := query.Get("direction"); dirStr == "backward" {
		direction = store.DirectionBackward
	}

	limit := 50
	if limitStr := query.Get("limit"); limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 || parsedLimit > 100 {
			app.badRequestResponse(w, r, errors.New("limit must be between 1 and 100"))
			return
		}
		limit = parsedLimit
	}

	filters := store.UserListFilters{Roles: roles, Search: search}
	listResult, err := app.store.Users.ListUsers(r.Context(), filters, userCursor, direction, limit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	// Fetch review assignment toggles to merge into response
	toggles, err := app.store.Settings.GetAllReviewAssignmentToggles(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	toggleMap := make(map[string]bool)
	for _, t := range toggles {
		toggleMap[t.ID] = t.Enabled
	}

	result := make([]AdminUserListItem, 0, len(listResult.Users))
	for _, u := range listResult.Users {
		item := AdminUserListItem{UserListItem: u}
		if u.Role == store.RoleSuperAdmin {
			enabled, exists := toggleMap[u.ID]
			if !exists {
				enabled = true
			}
			item.ReviewAssignmentEnabled = &enabled
		}
		result = append(result, item)
	}

	resp := AdminUserListResponse{
		Users:      result,
		NextCursor: listResult.NextCursor,
		PrevCursor: listResult.PrevCursor,
		HasMore:    listResult.HasMore,
	}
	if err := app.jsonResponse(w, http.StatusOK, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateUserRoleHandler updates a user's role
//
//	@Summary		Update user role (Super Admin)
//	@Description	Updates the role of a user by their ID
//	@Tags			superadmin/users
//	@Accept			json
//	@Produce		json
//	@Param			userID	path		string				true	"User ID"
//	@Param			role	body		UpdateRolePayload	true	"New role"
//	@Success		200		{object}	UserResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/users/{userID}/role [patch]
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
