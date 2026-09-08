package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hackutd/harp/internal/ratelimiter"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// remoteAddr is the client IP (with port, as net/http reports it without a
	// proxy); user, when non-empty, is the session user the stub resolver reports.
	newRequest := func(t *testing.T, remoteAddr, user string) *http.Request {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.RemoteAddr = remoteAddr
		if user != "" {
			req.Header.Set(testSessionUserHeader, user)
		}
		return req
	}

	t.Run("should allow anonymous requests under the IP limit", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(5, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		rr := executeRequest(newRequest(t, "192.168.1.1:1234", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should return 429 when the IP limit is exceeded", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(2, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		for i := 0; i < 2; i++ {
			rr := executeRequest(newRequest(t, "10.0.0.1:1234", ""), handler)
			checkResponseCode(t, http.StatusOK, rr.Code)
		}

		rr := executeRequest(newRequest(t, "10.0.0.1:1234", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
		assert.NotEmpty(t, rr.Header().Get("Retry-After"))
	})

	t.Run("should track IP buckets independently", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		rr := executeRequest(newRequest(t, "10.0.0.2:1234", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		rr = executeRequest(newRequest(t, "10.0.0.3:1234", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should ignore the client port when keying by IP", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		rr := executeRequest(newRequest(t, "10.0.0.4:1111", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		// same host, new ephemeral port: still the same bucket
		rr = executeRequest(newRequest(t, "10.0.0.4:2222", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)

		// RealIP leaves a bare address; that must also share the bucket
		rr = executeRequest(newRequest(t, "10.0.0.4", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
	})

	t.Run("should fall back to IP when the access token cookie is not a valid JWT", func(t *testing.T) {
		// Exercises the real SuperTokens resolver: an unparseable token must be
		// treated as no session, never as an error or a 5xx.
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		req := newRequest(t, "10.0.0.5:1234", "")
		req.AddCookie(&http.Cookie{Name: "sAccessToken", Value: "not-a-jwt"})
		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		req = newRequest(t, "10.0.0.5:1234", "")
		req.AddCookie(&http.Cookie{Name: "sAccessToken", Value: "not-a-jwt"})
		rr = executeRequest(req, handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
	})

	t.Run("should treat a missing resolver as no session", func(t *testing.T) {
		app := newTestApplication(t)
		app.sessionUserID = nil
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		rr := executeRequest(newRequest(t, "10.0.0.6:1234", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		rr = executeRequest(newRequest(t, "10.0.0.6:1234", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
	})

	t.Run("should key signed-in requests by user regardless of IP", func(t *testing.T) {
		app := newTestApplication(t)
		app.sessionUserID = headerSessionUserID
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		rr := executeRequest(newRequest(t, "10.0.0.7:1234", "st-user-1"), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)

		// same user from a different network still shares the bucket
		rr = executeRequest(newRequest(t, "10.0.0.8:1234", "st-user-1"), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
	})

	t.Run("should give signed-in users behind one IP independent buckets", func(t *testing.T) {
		// The venue case: many hackers behind a single NAT address.
		app := newTestApplication(t)
		app.sessionUserID = headerSessionUserID
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		for _, user := range []string{"st-user-1", "st-user-2", "st-user-3"} {
			rr := executeRequest(newRequest(t, "203.0.113.10:1234", user), handler)
			checkResponseCode(t, http.StatusOK, rr.Code)
		}

		rr := executeRequest(newRequest(t, "203.0.113.10:1234", "st-user-1"), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
	})

	t.Run("should keep user and IP budgets separate", func(t *testing.T) {
		app := newTestApplication(t)
		app.sessionUserID = headerSessionUserID
		app.rateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		// signed-in user exhausts their own bucket
		rr := executeRequest(newRequest(t, "203.0.113.20:1234", "st-user-1"), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
		rr = executeRequest(newRequest(t, "203.0.113.20:1234", "st-user-1"), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)

		// an anonymous request from the same IP has not been charged
		rr = executeRequest(newRequest(t, "203.0.113.20:1234", ""), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
		rr = executeRequest(newRequest(t, "203.0.113.20:1234", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)

		// and a different signed-in user on that IP is unaffected by either
		rr = executeRequest(newRequest(t, "203.0.113.20:1234", "st-user-2"), handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should throttle /v1 routes but never static assets", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		mux := app.mount()

		get := func(path string) *httptest.ResponseRecorder {
			req, err := http.NewRequest(http.MethodGet, path, nil)
			require.NoError(t, err)
			req.RemoteAddr = "10.0.0.9:1234"
			return executeRequest(req, mux)
		}

		// /v1/health needs Basic auth, so 401 proves the limiter let it through
		checkResponseCode(t, http.StatusUnauthorized, get("/v1/health").Code)
		checkResponseCode(t, http.StatusTooManyRequests, get("/v1/health").Code)

		// the SPA shell and its assets are served from /* and never counted,
		// even though this IP's bucket is exhausted
		for _, path := range []string{"/", "/assets/index-abc123.js", "/dashboard", "/auth/verify"} {
			assert.NotEqual(t, http.StatusTooManyRequests, get(path).Code, "expected %s to bypass the rate limiter", path)
		}
	})

	t.Run("should ignore forwarded headers the client can forge", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		mux := app.mount()

		get := func(headers map[string]string) *httptest.ResponseRecorder {
			req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
			require.NoError(t, err)
			req.RemoteAddr = "10.0.0.10:1234"
			for k, v := range headers {
				req.Header.Set(k, v)
			}
			return executeRequest(req, mux)
		}

		checkResponseCode(t, http.StatusUnauthorized, get(nil).Code)

		// a fresh spoofed address per request must not mint a fresh bucket
		for _, h := range []map[string]string{
			{"X-Real-IP": "203.0.113.1"},
			{"X-Forwarded-For": "203.0.113.2"},
			{"True-Client-IP": "203.0.113.3"},
			{"CF-Connecting-IP": "203.0.113.4"},
		} {
			checkResponseCode(t, http.StatusTooManyRequests, get(h).Code)
		}
	})

	t.Run("should key by the configured edge header when present", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.clientIP.header = "CF-Connecting-IP"
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		mux := app.mount()

		get := func(clientIP string) *httptest.ResponseRecorder {
			req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
			require.NoError(t, err)
			req.RemoteAddr = "10.0.0.11:1234" // the proxy; identical for every client
			req.Header.Set("CF-Connecting-IP", clientIP)
			req.Header.Set("X-Forwarded-For", "203.0.113.99") // must be ignored
			return executeRequest(req, mux)
		}

		checkResponseCode(t, http.StatusUnauthorized, get("198.51.100.1").Code)
		checkResponseCode(t, http.StatusTooManyRequests, get("198.51.100.1").Code)
		checkResponseCode(t, http.StatusUnauthorized, get("198.51.100.2").Code)
	})

	t.Run("should key by X-Forwarded-For only past the trusted proxy count", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.clientIP.trustedProxies = 1
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		mux := app.mount()

		get := func(xff string) *httptest.ResponseRecorder {
			req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
			require.NoError(t, err)
			req.RemoteAddr = "10.0.0.12:1234"
			req.Header.Set("X-Forwarded-For", xff)
			return executeRequest(req, mux)
		}

		// one proxy appends the real client as the rightmost entry; anything
		// the client prepended on the left is ignored
		checkResponseCode(t, http.StatusUnauthorized, get("198.51.100.1").Code)
		checkResponseCode(t, http.StatusTooManyRequests, get("203.0.113.5, 198.51.100.1").Code)
		checkResponseCode(t, http.StatusTooManyRequests, get("203.0.113.6, 198.51.100.1").Code)
		checkResponseCode(t, http.StatusUnauthorized, get("198.51.100.2").Code)
	})

	t.Run("should send Retry-After in whole seconds", func(t *testing.T) {
		app := newTestApplication(t)
		app.ipRateLimiter = ratelimiter.NewFixedWindowLimiter(1, 5*time.Second)
		handler := app.RateLimiterMiddleware(ok)

		executeRequest(newRequest(t, "10.0.0.13:1234", ""), handler)
		rr := executeRequest(newRequest(t, "10.0.0.13:1234", ""), handler)
		checkResponseCode(t, http.StatusTooManyRequests, rr.Code)
		assert.Regexp(t, `^[1-5]$`, rr.Header().Get("Retry-After"))
	})
}

func TestApplicationsEnabledMiddleware(t *testing.T) {
	app := newTestApplication(t)

	// Dummy handler that returns 200 if the middleware lets the request through
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("should return 401 when no user in context", func(t *testing.T) {
		handler := app.ApplicationsEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 403 when applications are disabled", func(t *testing.T) {
		app.store.Settings.(*store.MockSettingsStore).On("GetApplicationsEnabled", mock.Anything).Return(false, nil).Once()

		handler := app.ApplicationsEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should allow request when applications are enabled", func(t *testing.T) {
		app.store.Settings.(*store.MockSettingsStore).On("GetApplicationsEnabled", mock.Anything).Return(true, nil).Once()

		handler := app.ApplicationsEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should always allow super admin through", func(t *testing.T) {
		handler := app.ApplicationsEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should return 500 when store errors", func(t *testing.T) {
		app.store.Settings.(*store.MockSettingsStore).On("GetApplicationsEnabled", mock.Anything).Return(false, fmt.Errorf("db error")).Once()

		handler := app.ApplicationsEnabledMiddleware(ok)

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}
