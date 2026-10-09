package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const testPhotoPath = "profile-photos/user-1/0123456789abcdef0123456789abcdef.webp"

func userJSONRequest(t *testing.T, method string, body any) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(t, json.NewEncoder(&buf).Encode(body))
	}
	req, err := http.NewRequest(method, "/", &buf)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	return setUserContext(req, newTestUser())
}

func decodeUserResponse(t *testing.T, body *strings.Reader) UserResponse {
	t.Helper()
	var resp struct {
		Data UserResponse `json:"data"`
	}
	require.NoError(t, json.NewDecoder(body).Decode(&resp))
	return resp.Data
}

func TestUserPhotoObjectOwner(t *testing.T) {
	owner, ok := userPhotoObjectOwner(testPhotoPath)
	assert.True(t, ok)
	assert.Equal(t, "user-1", owner)

	for _, bad := range []string{
		"profile-photos/user-1/short.png",
		"profile-photos/user-1/0123456789abcdef0123456789abcdef.gif",
		"hackathons/h/resumes/user-1/0123456789abcdef0123456789abcdef.png",
		"profile-photos/user-1/nested/0123456789abcdef0123456789abcdef.png",
	} {
		_, ok := userPhotoObjectOwner(bad)
		assert.False(t, ok, bad)
	}
}

func TestOwnPhotoURL(t *testing.T) {
	google := "https://lh3.googleusercontent.com/a/photo"

	t.Run("uses the Google picture without an upload", func(t *testing.T) {
		user := newTestUser()
		user.ProfilePictureURL = &google
		resp := newUserResponse(user)
		assert.Equal(t, &google, resp.ProfilePictureUrl)
		assert.False(t, resp.CustomPhoto)
	})

	t.Run("points at the stable redirect for an upload, versioned by path", func(t *testing.T) {
		user := newTestUser()
		user.ProfilePictureURL = &google
		path := testPhotoPath
		user.PhotoPath = &path
		resp := newUserResponse(user)
		require.NotNil(t, resp.ProfilePictureUrl)
		assert.True(t, strings.HasPrefix(*resp.ProfilePictureUrl, "/v1/users/me/photo?v="))
		assert.True(t, resp.CustomPhoto)
		assert.Equal(t, &google, resp.GooglePictureUrl)

		other := "profile-photos/user-1/fedcba9876543210fedcba9876543210.png"
		user.PhotoPath = &other
		assert.NotEqual(t, *resp.ProfilePictureUrl, *newUserResponse(user).ProfilePictureUrl)
	})
}

func TestGenerateMyPhotoUploadURL(t *testing.T) {
	t.Run("signs a path under the user's own folder", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		mockGCS.On("GenerateImageUploadURL", mock.Anything, mock.MatchedBy(func(p string) bool {
			owner, ok := userPhotoObjectOwner(p)
			return ok && owner == "user-1" && strings.HasSuffix(p, ".png")
		}), "image/png").Return("https://upload.example.com", nil).Once()

		req := userJSONRequest(t, http.MethodPost, map[string]string{"content_type": "image/png"})
		rr := executeRequest(req, http.HandlerFunc(app.generateMyPhotoUploadURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		mockGCS.AssertExpectations(t)
	})

	t.Run("rejects unsupported image types", func(t *testing.T) {
		app := newTestApplication(t)
		req := userJSONRequest(t, http.MethodPost, map[string]string{"content_type": "image/gif"})
		rr := executeRequest(req, http.HandlerFunc(app.generateMyPhotoUploadURLHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestSetMyPhoto(t *testing.T) {
	t.Run("rejects a path owned by someone else", func(t *testing.T) {
		app := newTestApplication(t)
		users := app.store.Users.(*store.MockUsersStore)

		req := userJSONRequest(t, http.MethodPut, map[string]string{
			"photo_path": "profile-photos/user-2/0123456789abcdef0123456789abcdef.png",
		})
		rr := executeRequest(req, http.HandlerFunc(app.setMyPhotoHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		users.AssertNotCalled(t, "SetPhoto", mock.Anything, mock.Anything)
	})

	t.Run("saves the photo and deletes the one it replaced", func(t *testing.T) {
		app := newTestApplication(t)
		users := app.store.Users.(*store.MockUsersStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		previous := "profile-photos/user-1/fedcba9876543210fedcba9876543210.png"

		users.On("SetPhoto", "user-1", mock.MatchedBy(func(p *string) bool {
			return p != nil && *p == testPhotoPath
		})).Return(&previous, nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, previous).Return(nil).Once()

		req := userJSONRequest(t, http.MethodPut, map[string]string{"photo_path": testPhotoPath})
		rr := executeRequest(req, http.HandlerFunc(app.setMyPhotoHandler))
		app.backgroundJobs.Wait()

		checkResponseCode(t, http.StatusOK, rr.Code)
		resp := decodeUserResponse(t, strings.NewReader(rr.Body.String()))
		assert.True(t, resp.CustomPhoto)
		mockGCS.AssertExpectations(t)
	})
}

func TestDeleteMyPhoto(t *testing.T) {
	app := newTestApplication(t)
	users := app.store.Users.(*store.MockUsersStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	users.On("SetPhoto", "user-1", (*string)(nil)).Return(strPtr(testPhotoPath), nil).Once()
	mockGCS.On("DeleteObject", mock.Anything, testPhotoPath).Return(nil).Once()

	rr := executeRequest(userJSONRequest(t, http.MethodDelete, nil), http.HandlerFunc(app.deleteMyPhotoHandler))
	app.backgroundJobs.Wait()

	checkResponseCode(t, http.StatusOK, rr.Code)
	assert.False(t, decodeUserResponse(t, strings.NewReader(rr.Body.String())).CustomPhoto)
	mockGCS.AssertExpectations(t)
}

func TestGetMyPhoto(t *testing.T) {
	t.Run("redirects to a signed URL", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		mockGCS.On("GenerateDownloadURL", mock.Anything, testPhotoPath).Return("https://signed.example.com/photo", nil).Once()

		user := newTestUser()
		user.PhotoPath = strPtr(testPhotoPath)
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		rr := executeRequest(setUserContext(req, user), http.HandlerFunc(app.getMyPhotoHandler))

		checkResponseCode(t, http.StatusFound, rr.Code)
		assert.Equal(t, "https://signed.example.com/photo", rr.Header().Get("Location"))
	})

	t.Run("404s without an upload", func(t *testing.T) {
		app := newTestApplication(t)
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		rr := executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(app.getMyPhotoHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})
}

func strPtr(s string) *string { return &s }
