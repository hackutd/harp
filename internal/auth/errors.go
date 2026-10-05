package auth

import (
	"fmt"

	"github.com/hackutd/harp/internal/store"
)

type AuthMethodMismatchError struct {
	Expected store.AuthMethod
	Got      store.AuthMethod
}

func (e *AuthMethodMismatchError) Error() string {
	return fmt.Sprintf("auth method mismatch: expected %s, got %s", e.Expected, e.Got)
}

// UserMessage tells the user which sign-in method their email is registered with.
func (e *AuthMethodMismatchError) UserMessage() string {
	if e.Expected == store.AuthMethodGoogle {
		return "This email is registered with Google sign-in. Please use the Google option instead."
	}
	return "This email is registered with magic link sign-in. Please go back and use the email option instead."
}
