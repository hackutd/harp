package auth

import (
	"fmt"

	"github.com/hackutd/portal/internal/store"
)

type AuthMethodMismatchError struct {
	Expected store.AuthMethod
	Got      store.AuthMethod
}

func (e *AuthMethodMismatchError) Error() string {
	return fmt.Sprintf("auth method mismatch: expected %s, got %s", e.Expected, e.Got)
}
