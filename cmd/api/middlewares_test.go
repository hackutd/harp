package main

import (
	"net/http"
	"testing"
	"time"

	"github.com/hackutd/portal/internal/ratelimiter"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBasicAuthMiddleware(t *testing.T) {
	app := newTestApplication(t)

	// wrap simple 200 handler with the middleware
	handler := app.BasicAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("should return 401 when no authorization header", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, `Basic realm="restricted", charset="UTF-8"`, rr.Header().Get("WWW-Authenticate"))
	})

	t.Run("should return 401 when header is not Basic scheme", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req.Header.Set("Authorization", "Bearer sometoken")

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 401 with invalid base64", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req.Header.Set("Authorization", "Basic not-valid-base64!!!")

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 401 with wrong credentials", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req.SetBasicAuth("wrong", "creds")

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should pass through with valid credentials", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		addBasicAuth(req)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})
}

func TestRequireRoleMiddleware(t *testing.T) {
	app := newTestApplication(t)

	// Dummy handler that returns 200 if the middleware lets the request through
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("should return 401 when no user in context", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 403 when hacker tries to access admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser()) // hacker role

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should return 403 when hacker tries to access super_admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should return 403 when admin tries to access super_admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should allow admin to access admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should allow super_admin to access admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should allow super_admin to access super_admin route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleSuperAdmin)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should allow hacker to access hacker route", func(t *testing.T) {
		handler := app.RequireRoleMiddleware(store.RoleHacker)(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})
}

func TestRateLimiterMiddleware(t *testing.T) {
	t.Run("should allow requests under the limit", func(t *testing.T) {
		app := newTestApplication(t)
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(5, 5*time.Second)

		handler := app.RateLimiterMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.RemoteAddr = "192.168.1.1:1234"

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should return 429 when limit exceeded", func(t *testing.T) {
		app := newTestApplication(t)
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(2, 5*time.Second)

		handler := app.RateLimiterMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		// hit limit
		for i := 0; i < 2; i++ {
			req, err := http.NewRequest(http.MethodGet, "/", nil)
			require.NoError(t, err)
			req.RemoteAddr = "10.0.0.1:1234"

			rr := executeRequest(req, handler)
			checkResponseCode(t, http.StatusOK, rr.Code)
		}

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.RemoteAddr = "10.0.0.1:1234"

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
		assert.NotEmpty(t, rr.Header().Get("Retry-After"))
	})

	t.Run("should track limits per IP independently", func(t *testing.T) {
		app := newTestApplication(t)
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)

		handler := app.RateLimiterMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		// first IP hits limit
		req1, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req1.RemoteAddr = "10.0.0.2:1234"

		rr := executeRequest(req1, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		// different IP should be allowed
		req2, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req2.RemoteAddr = "10.0.0.3:1234"

		rr = executeRequest(req2, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})
}
