package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthCheck(t *testing.T) {
	app := newTestApplication(t)
	mux := app.mount()

	t.Run("should return 401 without basic auth", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
		require.NoError(t, err)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 401 with wrong credentials", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
		require.NoError(t, err)

		req.SetBasicAuth("wrong", "creds")

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 200 with valid basic auth", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/v1/health", nil)
		require.NoError(t, err)

		addBasicAuth(req)

		rr := executeRequest(req, mux)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var response map[string]string
		err = json.NewDecoder(rr.Body).Decode(&response)
		require.NoError(t, err)

		assert.Equal(t, "ok", response["status"])
		assert.Equal(t, "test", response["env"])
	})
}
