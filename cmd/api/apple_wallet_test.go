package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.uber.org/zap"
)

type fakeAppleWalletPassGenerator struct {
	pass      []byte
	err       error
	userID    string
	userEmail string
}

func (f *fakeAppleWalletPassGenerator) Generate(userID, email string) ([]byte, error) {
	f.userID = userID
	f.userEmail = email
	return f.pass, f.err
}

func TestGetAppleWalletStatusHandler(t *testing.T) {
	t.Run("unavailable", func(t *testing.T) {
		app := &application{logger: zap.NewNop().Sugar()}
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass/status", nil)

		app.getAppleWalletStatusHandler(response, request)

		checkResponseCode(t, http.StatusOK, response.Code)
		if response.Body.String() != "{\"data\":{\"available\":false}}\n" {
			t.Errorf("body = %q", response.Body.String())
		}
	})

	t.Run("available", func(t *testing.T) {
		app := &application{
			logger:            zap.NewNop().Sugar(),
			appleWalletPasses: &fakeAppleWalletPassGenerator{},
		}
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass/status", nil)

		app.getAppleWalletStatusHandler(response, request)

		checkResponseCode(t, http.StatusOK, response.Code)
		if response.Body.String() != "{\"data\":{\"available\":true}}\n" {
			t.Errorf("body = %q", response.Body.String())
		}
	})
}

func TestGetAppleWalletPassHandler(t *testing.T) {
	generator := &fakeAppleWalletPassGenerator{pass: []byte("signed pass")}
	app := &application{
		logger:            zap.NewNop().Sugar(),
		appleWalletPasses: generator,
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass", nil)
	request = setUserContext(request, newTestUser())

	app.getAppleWalletPassHandler(response, request)

	checkResponseCode(t, http.StatusOK, response.Code)
	if response.Header().Get("Content-Type") != appleWalletPassMIMEType {
		t.Errorf("Content-Type = %q", response.Header().Get("Content-Type"))
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Errorf("Cache-Control = %q", response.Header().Get("Cache-Control"))
	}
	if response.Body.String() != "signed pass" {
		t.Errorf("body = %q", response.Body.String())
	}
	if generator.userID != "user-1" || generator.userEmail != "hacker@test.com" {
		t.Errorf("Generate() called with %q, %q", generator.userID, generator.userEmail)
	}
}

func TestGetAppleWalletPassHandlerUnavailable(t *testing.T) {
	app := &application{logger: zap.NewNop().Sugar()}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass", nil)
	request = setUserContext(request, newTestUser())

	app.getAppleWalletPassHandler(response, request)

	checkResponseCode(t, http.StatusServiceUnavailable, response.Code)
}

func TestGetAppleWalletPassHandlerGenerationFailure(t *testing.T) {
	app := &application{
		logger: zap.NewNop().Sugar(),
		appleWalletPasses: &fakeAppleWalletPassGenerator{
			err: errors.New("signing failed"),
		},
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass", nil)
	request = setUserContext(request, newTestUser())

	app.getAppleWalletPassHandler(response, request)

	checkResponseCode(t, http.StatusInternalServerError, response.Code)
}
