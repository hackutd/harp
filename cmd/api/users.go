package main

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/hackutd/harp/internal/store"
	"github.com/supertokens/supertokens-golang/supertokens"
)

// A user owns at most one resume and five travel receipts, so the cleanup is a
// handful of deletes; this only has to outlast a slow bucket.
const userUploadDeleteTimeout = 2 * time.Minute

// deleteUserAndIdentity permanently removes a user's rows, their uploaded
// objects, and their auth identity. Shared by the self-serve and super admin
// delete handlers so the two can never drift.
//
// Storage and SuperTokens cleanup are best-effort: the database rows are already
// gone by then, so a failure there is logged rather than surfaced. Returns
// store.ErrNotFound when no such user exists.
func (app *application) deleteUserAndIdentity(r *http.Request, user *store.User) error {
	paths, err := app.store.Users.Delete(r.Context(), user.ID)
	if err != nil {
		return err
	}

	if paths != nil && (len(paths.Resumes) > 0 || len(paths.TravelReceipts) > 0) {
		go app.deleteUserUploads(user.ID, paths)
	}

	if err := supertokens.DeleteUser(user.SuperTokensUserID); err != nil {
		app.logger.Errorw("failed to delete supertokens user",
			"method", r.Method, "path", r.URL.Path,
			"user_id", user.ID, "error", err,
		)
	}

	return nil
}

// deleteUserUploads removes the objects a user deletion orphaned. It runs on its
// own context so the work outlives the request that triggered it.
func (app *application) deleteUserUploads(userID string, paths *store.DeletedUserPaths) {
	objectPaths := append(append([]string{}, paths.Resumes...), paths.TravelReceipts...)

	if app.gcsClient == nil {
		app.logger.Warnw("skipping upload cleanup because gcs is not configured",
			"user_id", userID, "objects", len(objectPaths),
		)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), userUploadDeleteTimeout)
	defer cancel()

	for _, objectPath := range objectPaths {
		if err := app.gcsClient.DeleteObject(ctx, objectPath); err != nil {
			app.logger.Warnw("failed to delete uploaded file from object storage",
				"user_id", userID, "path", objectPath, "error", err,
			)
		}
	}
}

// deleteMyAccountHandler permanently deletes the current user's account.
//
//	@Summary		Delete my account
//	@Description	Permanently deletes the authenticated user's account, application, uploads, scans, and auth identity
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

	if err := app.deleteUserAndIdentity(r, user); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("user not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
