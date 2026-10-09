package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/hackutd/harp/internal/store"
)

// A user's profile photo is the one picture shown for them everywhere: the
// Profile page and the sidebar. An uploaded photo wins; without one, the
// Google picture from sign-in is used.
//
// Photos belong to the user rather than to a hackathon, so they live outside
// hackathons/{slug}/ and survive a hackathon reset.
const userPhotoFolder = "profile-photos"

var userPhotoContentTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

type UserPhotoUploadURLPayload struct {
	ContentType string `json:"content_type" validate:"required,oneof=image/jpeg image/png image/webp"`
}

type UserPhotoUploadURLResponse struct {
	UploadURL string `json:"upload_url"`
	PhotoPath string `json:"photo_path"`
}

type SetUserPhotoPayload struct {
	PhotoPath string `json:"photo_path" validate:"required,max=300"`
}

// userPhotoObjectOwner returns the user a photo object belongs to, and whether
// the path has the shape this API issues: profile-photos/{userID}/{random}.{ext}.
func userPhotoObjectOwner(objectPath string) (string, bool) {
	parts := strings.Split(objectPath, "/")
	if len(parts) != 3 || parts[0] != userPhotoFolder || parts[1] == "" {
		return "", false
	}
	name, ext, ok := strings.Cut(parts[2], ".")
	if !ok || len(name) != randomResumeObjectIDBytes*2 || !isLowerHex(name) {
		return "", false
	}
	for _, e := range userPhotoContentTypes {
		if e == ext {
			return parts[1], true
		}
	}
	return "", false
}

func isLowerHex(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

// ownPhotoURL is the photo URL handed to the signed-in user about themselves.
// An uploaded photo goes through the stable /users/me/photo redirect rather
// than a signed URL, which would expire under a long-lived tab. The version
// changes with the path, so a new photo is never served from cache.
func ownPhotoURL(user *store.User) *string {
	if user.PhotoPath != nil && *user.PhotoPath != "" {
		sum := sha256.Sum256([]byte(*user.PhotoPath))
		url := "/v1/users/me/photo?v=" + hex.EncodeToString(sum[:6])
		return &url
	}
	return user.ProfilePictureURL
}

func newUserResponse(user *store.User) UserResponse {
	return UserResponse{
		ID:                user.ID,
		Email:             user.Email,
		Role:              user.Role,
		ProfilePictureUrl: ownPhotoURL(user),
		CustomPhoto:       user.PhotoPath != nil && *user.PhotoPath != "",
		GooglePictureUrl:  user.ProfilePictureURL,
		AuthMethod:        user.AuthMethod,
		Theme:             user.Theme,
		CreatedAt:         user.CreatedAt,
		UpdatedAt:         user.UpdatedAt,
	}
}

// deleteUserPhoto removes a replaced or cleared photo on a best-effort basis.
func (app *application) deleteUserPhoto(userID, objectPath string) {
	if app.gcsClient == nil {
		return
	}
	app.backgroundJobs.Add(1)
	go func() {
		defer app.backgroundJobs.Done()
		ctx, cancel := context.WithTimeout(context.Background(), userUploadDeleteTimeout)
		defer cancel()
		if err := app.gcsClient.DeleteObject(ctx, objectPath); err != nil {
			app.logger.Warnw("failed to delete replaced profile photo", "user_id", userID, "path", objectPath, "error", err)
		}
	}()
}

// generateMyPhotoUploadURLHandler returns a signed upload URL for a profile photo.
//
//	@Summary		Get profile photo upload URL
//	@Description	Generates a signed GCS upload URL for the caller's profile photo. Upload the image, then pass the returned photo_path to PUT /users/me/photo.
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			upload	body		UserPhotoUploadURLPayload	true	"Content type"
//	@Success		200		{object}	UserPhotoUploadURLResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Failure		503		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/users/me/photo-upload-url [post]
func (app *application) generateMyPhotoUploadURLHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req UserPhotoUploadURLPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if app.gcsClient == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "photo uploads are not configured")
		return
	}

	randomID, err := randomHex(randomResumeObjectIDBytes)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	objectPath := fmt.Sprintf("%s/%s/%s.%s", userPhotoFolder, user.ID, randomID, userPhotoContentTypes[req.ContentType])
	uploadURL, err := app.gcsClient.GenerateImageUploadURL(r.Context(), objectPath, req.ContentType)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, UserPhotoUploadURLResponse{
		UploadURL: uploadURL,
		PhotoPath: objectPath,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// setMyPhotoHandler makes an uploaded image the caller's profile photo.
//
//	@Summary		Set my profile photo
//	@Description	Sets the caller's profile photo to an image uploaded through POST /users/me/photo-upload-url. It is shown on the profile and in the sidebar.
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			photo	body		SetUserPhotoPayload	true	"Uploaded photo path"
//	@Success		200		{object}	UserResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/users/me/photo [put]
func (app *application) setMyPhotoHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req SetUserPhotoPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if owner, ok := userPhotoObjectOwner(req.PhotoPath); !ok || owner != user.ID {
		app.badRequestResponse(w, r, errors.New("invalid photo_path"))
		return
	}

	app.replaceUserPhoto(w, r, user, &req.PhotoPath)
}

// deleteMyPhotoHandler removes the caller's uploaded photo.
//
//	@Summary		Remove my profile photo
//	@Description	Removes the caller's uploaded profile photo. The Google picture from sign-in, if any, is shown instead.
//	@Tags			users
//	@Produce		json
//	@Success		200	{object}	UserResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/users/me/photo [delete]
func (app *application) deleteMyPhotoHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	app.replaceUserPhoto(w, r, user, nil)
}

func (app *application) replaceUserPhoto(w http.ResponseWriter, r *http.Request, user *store.User, photoPath *string) {
	previous, err := app.store.Users.SetPhoto(r.Context(), user.ID, photoPath)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	if previous != nil && *previous != "" && (photoPath == nil || *previous != *photoPath) {
		app.deleteUserPhoto(user.ID, *previous)
	}

	updated := *user
	updated.PhotoPath = photoPath
	if err := app.jsonResponse(w, http.StatusOK, newUserResponse(&updated)); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getMyPhotoHandler redirects to a short-lived signed URL for the caller's
// uploaded photo, so the page can keep one stable image URL.
//
//	@Summary		View my profile photo
//	@Description	Redirects to a signed URL for the caller's uploaded profile photo. 404 when none is uploaded.
//	@Tags			users
//	@Success		302
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/users/me/photo [get]
func (app *application) getMyPhotoHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	if user.PhotoPath == nil || *user.PhotoPath == "" || app.gcsClient == nil {
		app.notFoundResponse(w, r, errors.New("no profile photo"))
		return
	}
	url := app.photoURL(r.Context(), user.PhotoPath, nil)
	if url == nil {
		app.notFoundResponse(w, r, errors.New("no profile photo"))
		return
	}
	// Signed URLs live 15 minutes; the browser may reuse this hop for 10,
	// matching the server's signing cache.
	w.Header().Set("Cache-Control", "private, max-age=600")
	http.Redirect(w, r, *url, http.StatusFound)
}
