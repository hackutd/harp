package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/hackutd/portal/internal/auth"
	"github.com/hackutd/portal/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/session"
)

type contextKey string

const userContextKey contextKey = "user"

// Validates HTTP Basic authentication credentials
func (app *application) BasicAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			app.unauthorizedBasicErrorResponse(w, r, fmt.Errorf("authorization header is missing"))
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Basic" {
			app.unauthorizedBasicErrorResponse(w, r, fmt.Errorf("authorization header is malformed"))
			return
		}

		decoded, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			app.unauthorizedBasicErrorResponse(w, r, err)
			return
		}

		creds := strings.SplitN(string(decoded), ":", 2)
		if len(creds) != 2 || creds[0] != app.config.auth.basic.user || creds[1] != app.config.auth.basic.pass {
			app.unauthorizedBasicErrorResponse(w, r, fmt.Errorf("invalid credentials"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Rate limits per IP
func (app *application) RateLimiterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if allow, retryAfter := app.rateLimiter.Allow(r.RemoteAddr); !allow {
			app.rateLimiterExceededResponse(w, r, retryAfter.String())
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Verifies the SuperTokens session and loads the user into context
func (app *application) AuthRequiredMiddleware(next http.Handler) http.Handler {
	return session.VerifySession(nil, func(w http.ResponseWriter, r *http.Request) {
		sessionContainer := session.GetSessionFromRequestContext(r.Context())
		if sessionContainer == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("session not found"))
			return
		}

		// Grab profile picture URL from - Google OAuth
		var profilePictureURL *string
		sessionData, err := sessionContainer.GetSessionDataInDatabase()
		if err == nil && sessionData != nil {
			if pictureURL, ok := sessionData["profilePictureUrl"].(string); ok && pictureURL != "" {
				profilePictureURL = &pictureURL
			}
		}

		user, err := app.store.Users.GetBySuperTokensID(r.Context(), sessionContainer.GetUserID())
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				googleEnabled := app.config.supertokens.googleClientID != ""
				user, err = auth.CreateUserFromSession(r.Context(), sessionContainer, app.store, googleEnabled, profilePictureURL)
				if err != nil {
					var authErr *auth.AuthMethodMismatchError
					if errors.As(err, &authErr) {
						app.authMethodMismatchResponse(w, r, authErr.Expected, authErr.Got)
						return
					}
					app.internalServerError(w, r, err)
					return
				}
				app.logger.Infow("created new user", "user_id", user.ID, "email", user.Email)
			} else {
				app.internalServerError(w, r, err)
				return
			}
		} else {
			// User exists - update profile picture if it changed
			if user.AuthMethod == store.AuthMethodGoogle && profilePictureURL != nil {
				currentPicture := ""
				if user.ProfilePictureURL != nil {
					currentPicture = *user.ProfilePictureURL
				}
				if *profilePictureURL != currentPicture {
					if err := app.store.Users.UpdateProfilePicture(r.Context(), user.SuperTokensUserID, profilePictureURL); err != nil {
						app.logger.Warnw("failed to update profile picture", "error", err, "user_id", user.ID)
					} else {
						user.ProfilePictureURL = profilePictureURL
					}
				}
			}
		}

		// Sync role from DB to session claims if they differ
		accessTokenPayload := sessionContainer.GetAccessTokenPayload()
		if sessionRole, _ := accessTokenPayload["role"].(string); sessionRole != string(user.Role) {
			if err := sessionContainer.MergeIntoAccessTokenPayload(map[string]any{
				"role":         string(user.Role),
				"portalUserId": user.ID,
			}); err != nil {
				app.logger.Warnw("failed to sync role to session", "error", err, "user_id", user.ID)
			}
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

var roleLevel = map[store.UserRole]int{
	store.RoleHacker:     1,
	store.RoleAdmin:      2,
	store.RoleSuperAdmin: 3,
}

// Checks if the authenticated user has at least the specified role
func (app *application) RequireRoleMiddleware(minRole store.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := getUserFromContext(r.Context())
			if user == nil {
				app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
				return
			}

			if roleLevel[user.Role] < roleLevel[minRole] {
				app.forbiddenResponse(w, r, fmt.Errorf("insufficient permissions"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func getUserFromContext(ctx context.Context) *store.User {
	user, _ := ctx.Value(userContextKey).(*store.User)
	return user
}
