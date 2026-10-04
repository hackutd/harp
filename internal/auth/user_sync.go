package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/hackutd/harp/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty"
)

func CreateUserFromSession(ctx context.Context, sessionContainer sessmodels.SessionContainer, appStore store.Storage, googleOAuthEnabled bool, relinkByEmail bool, profilePictureURL *string) (*store.User, error) {
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
			return resolveEmailConflict(ctx, appStore, user, relinkByEmail)
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// resolveEmailConflict handles a sign-in whose SuperTokens ID is new but whose
// email already has a user row.
func resolveEmailConflict(ctx context.Context, appStore store.Storage, attempted *store.User, relinkByEmail bool) (*store.User, error) {
	existingUser, err := appStore.Users.GetByEmail(ctx, attempted.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing user: %w", err)
	}
	if existingUser.AuthMethod != attempted.AuthMethod {
		return nil, &AuthMethodMismatchError{
			Expected: existingUser.AuthMethod,
			Got:      attempted.AuthMethod,
		}
	}
	// Same email and auth method but a different SuperTokens ID. In prod this
	// should never happen. On staging it is every returning user, because the
	// database is a branch of prod and the SuperTokens core is not.
	if !relinkByEmail {
		return nil, fmt.Errorf("unexpected state: same email and auth method but different supertokens id")
	}
	relinked, err := appStore.Users.UpdateSuperTokensID(ctx, existingUser.ID, attempted.SuperTokensUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to relink supertokens id: %w", err)
	}
	return relinked, nil
}
