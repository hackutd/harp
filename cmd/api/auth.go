package main

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/hackutd/portal/internal/store"
)

// JSON response for user data
type UserResponse struct {
	ID        string         `json:"id"`
	Email     string         `json:"email"`
	Role      store.UserRole `json:"role"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// getCurrentUserHandler returns the currently authenticated user
//
//	@Summary		Get current user
//	@Description	Returns the authenticated user's profile
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	UserResponse
//	@Failure		401	{object}	object{error=string}
//	@Router			/auth/me [get]
func (app *application) getCurrentUserHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, nil)
		return
	}

	response := UserResponse{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// JSON response for email auth method check
type CheckEmailResponse struct {
	Exists     bool              `json:"exists"`
	AuthMethod *store.AuthMethod `json:"auth_method,omitempty"`
}

//
//	@Summary		Check email auth method
//	@Description	Checks if an email is registered and returns the auth method used
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			email	query		string	true	"Email address to check"
//	@Success		200		{object}	CheckEmailResponse
//	@Failure		400		{object}	object{error=string}
//	@Router			/auth/check-email [get]
func (app *application) checkEmailAuthMethodHandler(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		app.badRequestResponse(w, r, fmt.Errorf("email query parameter is required"))
		return
	}

	user, err := app.store.Users.GetByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Email not registered
			if err := app.jsonResponse(w, http.StatusOK, CheckEmailResponse{Exists: false}); err != nil {
				app.internalServerError(w, r, err)
			}
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	// Email exists - return the auth method
	if err := app.jsonResponse(w, http.StatusOK, CheckEmailResponse{
		Exists:     true,
		AuthMethod: &user.AuthMethod,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}
