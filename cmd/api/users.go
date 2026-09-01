package main

import (
	"errors"
	"net/http"

	"github.com/supertokens/supertokens-golang/supertokens"
)

// deleteMyAccountHandler permanently deletes the current user's account.
//
//	@Summary		Delete my account
//	@Description	Permanently deletes the authenticated user's account, application, scans, and auth identity
//	@Tags			hackers
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/users/me [delete]
func (app *application) deleteMyAccountHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	if err := app.store.Users.Delete(r.Context(), user.ID); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := supertokens.DeleteUser(user.SuperTokensUserID); err != nil {
		app.logger.Errorw("failed to delete supertokens user",
			"method", r.Method, "path", r.URL.Path,
			"user_id", user.ID, "error", err,
		)
	}

	w.WriteHeader(http.StatusNoContent)
}
