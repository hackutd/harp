package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func withReferralRouteParam(req *http.Request, referralID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("referralID", referralID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestGenerateReferralCode(t *testing.T) {
	seen := map[string]bool{}
	for range 50 {
		code, err := generateReferralCode()
		require.NoError(t, err)
		assert.Len(t, code, referralCodeLength)
		assert.NoError(t, validReferralCode(code))
		seen[code] = true
	}
	assert.Greater(t, len(seen), 45, "codes should not repeat")
}

func TestListReferrals(t *testing.T) {
	app := newTestApplication(t)
	mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

	t.Run("should list referrals", func(t *testing.T) {
		mockReferrals.On("List").Return([]store.Referral{
			{ID: "ref-1", Name: "T-Mobile", Code: "NbjlBgit", VisitCount: 12, SignupCount: 3, CreatedAt: time.Now()},
		}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.listReferralsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReferralListResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		require.Len(t, body.Data.Referrals, 1)
		assert.Equal(t, "NbjlBgit", body.Data.Referrals[0].Code)
		assert.Equal(t, 3, body.Data.Referrals[0].SignupCount)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should return 500 on store error", func(t *testing.T) {
		mockReferrals.On("List").Return(nil, errors.New("db down")).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.listReferralsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
		mockReferrals.AssertExpectations(t)
	})
}

func TestCreateReferral(t *testing.T) {
	t.Run("should generate a random code when none is given", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

		mockReferrals.On("Create", mock.MatchedBy(func(ref *store.Referral) bool {
			return ref.Name == "T-Mobile" && len(ref.Code) == referralCodeLength
		})).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"  T-Mobile "}`))
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.createReferralHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should retry when a generated code collides", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

		mockReferrals.On("Create", mock.Anything).Return(store.ErrConflict).Once()
		mockReferrals.On("Create", mock.Anything).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"T-Mobile"}`))
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.createReferralHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should use a custom code", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

		mockReferrals.On("Create", mock.MatchedBy(func(ref *store.Referral) bool {
			return ref.Code == "tmobile"
		})).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"T-Mobile","code":"tmobile"}`))
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.createReferralHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should return 409 when a custom code is taken", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

		mockReferrals.On("Create", mock.Anything).Return(store.ErrConflict).Once()

		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"T-Mobile","code":"tmobile"}`))
		require.NoError(t, err)

		rr := executeRequest(req, http.HandlerFunc(app.createReferralHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	for name, body := range map[string]string{
		"missing name":       `{"code":"tmobile"}`,
		"code with a space":  `{"name":"T-Mobile","code":"t mobile"}`,
		"code too short":     `{"name":"T-Mobile","code":"ab"}`,
		"code with a symbol": `{"name":"T-Mobile","code":"t&mobile"}`,
	} {
		t.Run("should return 400 for "+name, func(t *testing.T) {
			app := newTestApplication(t)

			req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			require.NoError(t, err)

			rr := executeRequest(req, http.HandlerFunc(app.createReferralHandler))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
		})
	}
}

func TestUpdateReferral(t *testing.T) {
	t.Run("should update name and code", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

		mockReferrals.On("Update", mock.MatchedBy(func(ref *store.Referral) bool {
			return ref.ID == "ref-1" && ref.Name == "T-Mobile US" && ref.Code == "NbjlBgit"
		})).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"name":"T-Mobile US","code":"NbjlBgit"}`))
		require.NoError(t, err)
		req = withReferralRouteParam(req, "ref-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateReferralHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should return 404 when missing", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)
		mockReferrals.On("Update", mock.Anything).Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"name":"T-Mobile","code":"NbjlBgit"}`))
		require.NoError(t, err)
		req = withReferralRouteParam(req, "nope")

		rr := executeRequest(req, http.HandlerFunc(app.updateReferralHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	t.Run("should return 409 when the code is taken", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)
		mockReferrals.On("Update", mock.Anything).Return(store.ErrConflict).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"name":"T-Mobile","code":"taken"}`))
		require.NoError(t, err)
		req = withReferralRouteParam(req, "ref-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateReferralHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)
	})

	t.Run("should return 400 without a code", func(t *testing.T) {
		app := newTestApplication(t)

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"name":"T-Mobile"}`))
		require.NoError(t, err)
		req = withReferralRouteParam(req, "ref-1")

		rr := executeRequest(req, http.HandlerFunc(app.updateReferralHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestDeleteReferral(t *testing.T) {
	app := newTestApplication(t)
	mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

	t.Run("should delete", func(t *testing.T) {
		mockReferrals.On("Delete", "ref-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = withReferralRouteParam(req, "ref-1")

		rr := executeRequest(req, http.HandlerFunc(app.deleteReferralHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)
	})

	t.Run("should return 404 when missing", func(t *testing.T) {
		mockReferrals.On("Delete", "nope").Return(store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = withReferralRouteParam(req, "nope")

		rr := executeRequest(req, http.HandlerFunc(app.deleteReferralHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	mockReferrals.AssertExpectations(t)
}

func TestListReferralSignups(t *testing.T) {
	app := newTestApplication(t)
	mockReferrals := app.store.Referrals.(*store.MockReferralsStore)

	t.Run("should list signups", func(t *testing.T) {
		mockReferrals.On("ListSignups", "ref-1").Return([]store.ReferralSignup{
			{UserID: "user-1", Email: "hacker@example.com", CreatedAt: time.Now()},
		}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = withReferralRouteParam(req, "ref-1")

		rr := executeRequest(req, http.HandlerFunc(app.listReferralSignupsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReferralSignupsResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		require.Len(t, body.Data.Signups, 1)
		assert.Equal(t, "hacker@example.com", body.Data.Signups[0].Email)
	})

	t.Run("should return 404 when the referral is missing", func(t *testing.T) {
		mockReferrals.On("ListSignups", "nope").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = withReferralRouteParam(req, "nope")

		rr := executeRequest(req, http.HandlerFunc(app.listReferralSignupsHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	mockReferrals.AssertExpectations(t)
}

func TestRecordReferralVisit(t *testing.T) {
	t.Run("should count a visit without a session", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)
		mux := app.mount()

		mockReferrals.On("RecordVisit", "NbjlBgit").Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/v1/referrals/NbjlBgit/visit", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNoContent, rr.Code)
		mockReferrals.AssertExpectations(t)
	})

	t.Run("should ignore a malformed code", func(t *testing.T) {
		app := newTestApplication(t)
		mockReferrals := app.store.Referrals.(*store.MockReferralsStore)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodPost, "/v1/referrals/a%20b/visit", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusNoContent, rr.Code)
		mockReferrals.AssertNotCalled(t, "RecordVisit", mock.Anything)
	})
}

func TestReferralRoutesRequireRole(t *testing.T) {
	t.Run("should reject a request without a session", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, err := http.NewRequest(http.MethodGet, "/v1/superadmin/referrals", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	// Mirrors the mount: the referral routes sit behind RequireRole(super_admin).
	for name, user := range map[string]*store.User{
		"hacker": newTestUser(),
		"admin":  newAdminUser(),
	} {
		t.Run("should forbid "+name, func(t *testing.T) {
			app := newTestApplication(t)
			r := chi.NewRouter()
			r.With(app.RequireRoleMiddleware(store.RoleSuperAdmin)).Get("/", app.listReferralsHandler)

			req, err := http.NewRequest(http.MethodGet, "/", nil)
			require.NoError(t, err)
			req = setUserContext(req, user)

			rr := executeRequest(req, r)
			checkResponseCode(t, http.StatusForbidden, rr.Code)
		})
	}
}
