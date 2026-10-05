package main

import (
	"crypto/rand"
	"crypto/rsa"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testCFAccess = cfAccessConfig{teamDomain: "acmutd.cloudflareaccess.com", aud: "test-aud-tag"}

func newCFAccessTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return key
}

func signCFAccessToken(t *testing.T, key *rsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(key)
	require.NoError(t, err)
	return token
}

func validCFAccessClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"aud":   []string{testCFAccess.aud},
		"iss":   testCFAccess.issuer(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"iat":   time.Now().Unix(),
		"email": "officer@acmutd.co",
	}
}

func TestVerifyCFAccessToken(t *testing.T) {
	key := newCFAccessTestKey(t)
	keys := func(*jwt.Token) (any, error) { return &key.PublicKey, nil }

	t.Run("valid token", func(t *testing.T) {
		token := signCFAccessToken(t, key, validCFAccessClaims())
		assert.NoError(t, verifyCFAccessToken(token, testCFAccess, keys))
	})

	t.Run("missing token", func(t *testing.T) {
		assert.Error(t, verifyCFAccessToken("", testCFAccess, keys))
	})

	t.Run("signed by another key", func(t *testing.T) {
		token := signCFAccessToken(t, newCFAccessTestKey(t), validCFAccessClaims())
		assert.Error(t, verifyCFAccessToken(token, testCFAccess, keys))
	})

	t.Run("another access application", func(t *testing.T) {
		claims := validCFAccessClaims()
		claims["aud"] = []string{"some-other-app"}
		assert.Error(t, verifyCFAccessToken(signCFAccessToken(t, key, claims), testCFAccess, keys))
	})

	t.Run("another team", func(t *testing.T) {
		claims := validCFAccessClaims()
		claims["iss"] = "https://someone-else.cloudflareaccess.com"
		assert.Error(t, verifyCFAccessToken(signCFAccessToken(t, key, claims), testCFAccess, keys))
	})

	t.Run("expired", func(t *testing.T) {
		claims := validCFAccessClaims()
		claims["exp"] = time.Now().Add(-time.Hour).Unix()
		assert.Error(t, verifyCFAccessToken(signCFAccessToken(t, key, claims), testCFAccess, keys))
	})

	t.Run("no expiry", func(t *testing.T) {
		claims := validCFAccessClaims()
		delete(claims, "exp")
		assert.Error(t, verifyCFAccessToken(signCFAccessToken(t, key, claims), testCFAccess, keys))
	})

	t.Run("unsigned", func(t *testing.T) {
		token, err := jwt.NewWithClaims(jwt.SigningMethodNone, validCFAccessClaims()).SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)
		assert.Error(t, verifyCFAccessToken(token, testCFAccess, keys))
	})
}

func TestCFAccessMiddleware(t *testing.T) {
	key := newCFAccessTestKey(t)

	t.Run("enforced when configured", func(t *testing.T) {
		app := newTestApplication(t)
		app.config.cfAccess = testCFAccess
		app.cfAccessKeys = func(*jwt.Token) (any, error) { return &key.PublicKey, nil }
		mux := app.mount()

		// /v1/health answers 401 without basic auth, so a 401 means the request
		// got past the Access check and a 403 means it did not.
		req, _ := http.NewRequest(http.MethodGet, "/v1/health", nil)
		rr := executeRequest(req, mux)
		assert.Equal(t, http.StatusForbidden, rr.Code)

		req, _ = http.NewRequest(http.MethodGet, "/v1/health", nil)
		req.Header.Set(cfAccessJWTHeader, signCFAccessToken(t, key, validCFAccessClaims()))
		rr = executeRequest(req, mux)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("off when not configured", func(t *testing.T) {
		app := newTestApplication(t)
		mux := app.mount()

		req, _ := http.NewRequest(http.MethodGet, "/v1/health", nil)
		rr := executeRequest(req, mux)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

func TestNormalizeCFAccessTeamDomain(t *testing.T) {
	for _, raw := range []string{
		"acmutd.cloudflareaccess.com",
		"https://acmutd.cloudflareaccess.com",
		"https://acmutd.cloudflareaccess.com/",
		" acmutd.cloudflareaccess.com ",
	} {
		assert.Equal(t, "acmutd.cloudflareaccess.com", normalizeCFAccessTeamDomain(raw), raw)
	}
}
