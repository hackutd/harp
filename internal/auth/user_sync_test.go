package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveEmailConflict(t *testing.T) {
	existing := &store.User{
		ID:                "user-1",
		SuperTokensUserID: "st-prod",
		Email:             "hacker@example.com",
		Role:              store.RoleAdmin,
		AuthMethod:        store.AuthMethodPasswordless,
	}
	attempted := &store.User{
		SuperTokensUserID: "st-staging",
		Email:             "hacker@example.com",
		Role:              store.RoleHacker,
		AuthMethod:        store.AuthMethodPasswordless,
	}

	t.Run("relink disabled keeps refusing", func(t *testing.T) {
		s := store.NewMockStore()
		users := s.Users.(*store.MockUsersStore)
		users.On("GetByEmail", "hacker@example.com").Return(existing, nil)

		_, err := resolveEmailConflict(context.Background(), s, attempted, false)
		require.Error(t, err)
		users.AssertNotCalled(t, "UpdateSuperTokensID", "user-1", "st-staging")
	})

	t.Run("relink enabled takes over the existing row", func(t *testing.T) {
		s := store.NewMockStore()
		users := s.Users.(*store.MockUsersStore)
		users.On("GetByEmail", "hacker@example.com").Return(existing, nil)
		relinked := *existing
		relinked.SuperTokensUserID = "st-staging"
		users.On("UpdateSuperTokensID", "user-1", "st-staging").Return(&relinked, nil)

		user, err := resolveEmailConflict(context.Background(), s, attempted, true)
		require.NoError(t, err)
		assert.Equal(t, "st-staging", user.SuperTokensUserID)
		assert.Equal(t, store.RoleAdmin, user.Role)
	})

	t.Run("auth method mismatch is reported even with relink on", func(t *testing.T) {
		s := store.NewMockStore()
		users := s.Users.(*store.MockUsersStore)
		users.On("GetByEmail", "hacker@example.com").Return(existing, nil)
		google := *attempted
		google.AuthMethod = store.AuthMethodGoogle

		_, err := resolveEmailConflict(context.Background(), s, &google, true)
		var mismatch *AuthMethodMismatchError
		require.True(t, errors.As(err, &mismatch))
		assert.Equal(t, store.AuthMethodPasswordless, mismatch.Expected)
		users.AssertNotCalled(t, "UpdateSuperTokensID", "user-1", "st-staging")
	})
}
