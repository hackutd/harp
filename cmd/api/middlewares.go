package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/hackutd/harp/internal/auth"
	"github.com/hackutd/harp/internal/ratelimiter"
	"github.com/hackutd/harp/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
)

type contextKey string

const userContextKey contextKey = "user"

// sessionUserIDResolver reports the SuperTokens user ID behind a request, or
// false when the request carries no verifiable session.
type sessionUserIDResolver func(w http.ResponseWriter, r *http.Request) (string, bool)

// supertokensSessionUserID reads the session without requiring one. Only a
// signature-verified access token yields a user ID, so a forged token cannot
// mint its own rate-limit bucket. Missing, expired, or invalid tokens report
// false and the caller falls back to the client IP. Verification is local
// (cached JWKS); no call to the SuperTokens core is made.
func supertokensSessionUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	optional := false
	sess, err := session.GetSession(r, w, &sessmodels.VerifySessionOptions{
		SessionRequired: &optional,
		AntiCsrfCheck:   &optional,
	})
	if err != nil || sess == nil {
		return "", false
	}
	return sess.GetUserID(), true
}

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

// Rate limits per signed-in user, falling back to the client IP for requests
// without a verified session. Per-user buckets keep one venue NAT full of
// hackers from exhausting a single shared budget.
func (app *application) RateLimiterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limiter, key := app.rateLimiterFor(w, r)
		if allow, retryAfter := limiter.Allow(key); !allow {
			app.rateLimiterExceededResponse(w, r, key, retryAfter.String())
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Picks the limiter and bucket key for a request: the per-user limiter keyed
// by SuperTokens user ID when a session verifies, else the per-IP limiter.
func (app *application) rateLimiterFor(w http.ResponseWriter, r *http.Request) (ratelimiter.Limiter, string) {
	if app.sessionUserID != nil {
		if userID, ok := app.sessionUserID(w, r); ok {
			return app.rateLimiter, "user:" + userID
		}
	}
	return app.ipRateLimiter, "ip:" + clientIP(r)
}

// middleware.RealIP rewrites RemoteAddr to the bare forwarded IP behind a
// proxy, but without one RemoteAddr keeps its port, which would make every
// connection its own bucket.
func clientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
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

// Validates the X-API-Key header for public API endpoints
func (app *application) APIKeyMiddleware(next http.Handler) http.Handler {
	expectedKey := []byte(app.config.auth.publicAPIKey)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" || subtle.ConstantTimeCompare([]byte(key), expectedKey) != 1 {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("invalid or missing API key"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Blocks schedule mutations by admins when the admin schedule edit setting is disabled.
// Super admins are always allowed.
func (app *application) AdminScheduleEditPermissionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetAdminScheduleEditEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if user.Role == store.RoleAdmin && !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("admin schedule editing is disabled"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Checks whether the applications feature is enabled. If not, blocks access to all application-related endpoints for non-super-admins.
func (app *application) ApplicationsEnabledMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetApplicationsEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("applications are currently closed"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Checks whether RSVPs are enabled. If not, blocks RSVP submission for non-super-admins.
func (app *application) RSVPEnabledMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetRSVPEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("rsvps are currently closed"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Checks whether travel RSVPs are enabled. If not, blocks travel RSVP submission for non-super-admins.
func (app *application) TravelRSVPEnabledMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetTravelRSVPEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("travel rsvps are currently closed"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) AdminSponsorEditPermissionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetAdminSponsorEditEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if user.Role == store.RoleAdmin && !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("admin sponsor editing is disabled"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) AdminFAQEditPermissionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r.Context())
		if user == nil {
			app.unauthorizedErrorResponse(w, r, fmt.Errorf("user not in context"))
			return
		}

		if user.Role == store.RoleSuperAdmin {
			next.ServeHTTP(w, r)
			return
		}

		enabled, err := app.store.Settings.GetAdminFAQEditEnabled(r.Context())
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if user.Role == store.RoleAdmin && !enabled {
			app.forbiddenResponse(w, r, fmt.Errorf("admin FAQ editing is disabled"))
			return
		}

		next.ServeHTTP(w, r)
	})
}
