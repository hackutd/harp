package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/hackutd/portal/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty"
)

func CreateUserFromSession(ctx context.Context, sessionContainer sessmodels.SessionContainer, appStore store.Storage, googleOAuthEnabled bool, profilePictureURL *string) (*store.User, error) {
	supertokensUserID := sessionContainer.GetUserID()

	// Try to get user from passwordless recipe first
	email := ""
	var authMethod store.AuthMethod
	plessUser, err := passwordless.GetUserByID(supertokensUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get passwordless user info: %w", err)
	}
	if plessUser != nil && plessUser.Email != nil {
		email = *plessUser.Email
		authMethod = store.AuthMethodPasswordless
	}

	// If not found in passwordless try Google OAuth (only if configured)
	if email == "" && googleOAuthEnabled {
		tpUser, err := thirdparty.GetUserByID(supertokensUserID)
		if err != nil {
			return nil, fmt.Errorf("failed to get thirdparty user info: %w", err)
		}
		if tpUser != nil {
			email = tpUser.Email
			authMethod = store.AuthMethodGoogle
		}
	}

	if email == "" {
		return nil, fmt.Errorf("user not found in supertokens")
	}

	user := &store.User{
		SuperTokensUserID: supertokensUserID,
		Email:             email,
		Role:              store.RoleHacker,
		AuthMethod:        authMethod,
		ProfilePictureURL: profilePictureURL,
	}

	if err := appStore.Users.Create(ctx, user); err != nil {
		if errors.Is(err, store.ErrConflict) {
			// Email exists - check if auth method matches
			existingUser, err := appStore.Users.GetByEmail(ctx, email)
			if err != nil {
				return nil, fmt.Errorf("failed to get existing user: %w", err)
			}
			if existingUser.AuthMethod != authMethod {
				return nil, &AuthMethodMismatchError{
					Expected: existingUser.AuthMethod,
					Got:      authMethod,
				}
			}
			// Same auth method but different SuperTokens ID - should never happen
			return nil, fmt.Errorf("unexpected state: same email and auth method but different supertokens id")
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}
