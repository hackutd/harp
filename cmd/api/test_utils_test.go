package main

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/ratelimiter"
	"github.com/hackutd/harp/internal/store"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/plessmodels"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/supertokens"
	"go.uber.org/zap"
)

var initSuperTokensOnce sync.Once

// dummy config so mount() doesn't panic
func initTestSuperTokens(t *testing.T) {
	t.Helper()
	initSuperTokensOnce.Do(func() {
		err := supertokens.Init(supertokens.TypeInput{
			Supertokens: &supertokens.ConnectionInfo{
				ConnectionURI: "http://localhost:3567",
			},
			AppInfo: supertokens.AppInfo{
				AppName:       "test",
				APIDomain:     "http://localhost:8080",
				WebsiteDomain: "http://localhost:3000",
			},
			RecipeList: []supertokens.Recipe{
				passwordless.Init(plessmodels.TypeInput{
					ContactMethodEmail: plessmodels.ContactMethodEmailConfig{Enabled: true},
					FlowType:           "MAGIC_LINK",
				}),
				session.Init(&sessmodels.TypeInput{}),
			},
		})
		if err != nil {
			t.Fatalf("failed to init supertokens for tests: %v", err)
		}
	})
}

func newTestApplication(t *testing.T) *application {
	t.Helper()

	initTestSuperTokens(t)

	logger := zap.NewNop().Sugar()
	// Uncomment uncomment below for debugging
	// logger = zap.Must(zap.NewProduction()).Sugar()

	mockStore := store.NewMockStore()

	rateLimiter := ratelimiter.NewFixedWindowLimiter(20, 5*time.Second)
	ipRateLimiter := ratelimiter.NewFixedWindowLimiter(200, 5*time.Second)

	return &application{
		config: config{
			env: "test",
			auth: authConfig{
				basic: basicConfig{
					user: "testuser",
					pass: "testpass",
				},
				publicAPIKey: "test-api-key",
			},
			rateLimiter: ratelimiter.Config{
				RequestPerTimeFrame:   20,
				IPRequestPerTimeFrame: 200,
				TimeFrame:             5 * time.Second,
				Enabled:               true,
			},
		},
		store:         mockStore,
		logger:        logger,
		mailer:        &mailer.MockClient{},
		gcsClient:     &gcs.MockClient{},
		rateLimiter:   rateLimiter,
		ipRateLimiter: ipRateLimiter,
		// Real resolver: with no session cookie it reports false without
		// contacting the core, so tests exercise the IP fallback by default.
		sessionUserID: supertokensSessionUserID,
	}
}

// Stand-in for SuperTokens session resolution so rate limiter tests can vary
// the user per request without a running core. Requests without the header
// behave like requests with no verifiable session.
const testSessionUserHeader = "X-Test-Session-User"

func headerSessionUserID(_ http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.Header.Get(testSessionUserHeader)
	return id, id != ""
}

func executeRequest(req *http.Request, mux http.Handler) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	return rr
}

func checkResponseCode(t *testing.T, expected, actual int) {
	t.Helper()
	if expected != actual {
		t.Errorf("Expected response code %d. Got %d", expected, actual)
	}
}

func addBasicAuth(req *http.Request) {
	creds := base64.StdEncoding.EncodeToString([]byte("testuser:testpass"))
	req.Header.Set("Authorization", "Basic "+creds)
}

// for testing handlers without going through SuperTokens
func setUserContext(req *http.Request, user *store.User) *http.Request {
	ctx := context.WithValue(req.Context(), userContextKey, user)
	return req.WithContext(ctx)
}

// Test Users:

func newTestUser() *store.User {
	return &store.User{
		ID:                "user-1",
		SuperTokensUserID: "st-user-1",
		Email:             "hacker@test.com",
		Role:              store.RoleHacker,
		AuthMethod:        store.AuthMethodPasswordless,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

func newAdminUser() *store.User {
	return &store.User{
		ID:                "admin-1",
		SuperTokensUserID: "st-admin-1",
		Email:             "admin@test.com",
		Role:              store.RoleAdmin,
		AuthMethod:        store.AuthMethodPasswordless,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

func newSuperAdminUser() *store.User {
	return &store.User{
		ID:                "superadmin-1",
		SuperTokensUserID: "st-superadmin-1",
		Email:             "superadmin@test.com",
		Role:              store.RoleSuperAdmin,
		AuthMethod:        store.AuthMethodPasswordless,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}
