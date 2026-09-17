package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hackutd/harp/internal/store"
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
		store:             store.NewMockStore(),
		appleWalletPasses: generator,
	}
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockSettings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass", nil)
	request = setUserContext(request, newTestUser())

	app.getAppleWalletPassHandler(response, request)

	checkResponseCode(t, http.StatusOK, response.Code)
	if response.Header().Get("Content-Type") != appleWalletPassMIMEType {
		t.Errorf("Content-Type = %q", response.Header().Get("Content-Type"))
	}
	wantDisposition := `attachment; filename="hackutd-2026-hacker-pass.pkpass"`
	if response.Header().Get("Content-Disposition") != wantDisposition {
		t.Errorf("Content-Disposition = %q, want %q",
			response.Header().Get("Content-Disposition"), wantDisposition)
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
	mockSettings.AssertExpectations(t)
}

// A settings read failure must not cost the hacker their pass — the pass is
// already signed by then, so only the filename degrades.
func TestGetAppleWalletPassHandlerServesPassWhenSettingsFail(t *testing.T) {
	app := &application{
		logger:            zap.NewNop().Sugar(),
		store:             store.NewMockStore(),
		appleWalletPasses: &fakeAppleWalletPassGenerator{pass: []byte("signed pass")},
	}
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockSettings.On("GetHackathonName").Return("", errors.New("db down")).Once()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/wallet/apple-pass", nil)
	request = setUserContext(request, newTestUser())

	app.getAppleWalletPassHandler(response, request)

	checkResponseCode(t, http.StatusOK, response.Code)
	wantDisposition := `attachment; filename="` + defaultAppleWalletPassFilename + `"`
	if response.Header().Get("Content-Disposition") != wantDisposition {
		t.Errorf("Content-Disposition = %q, want %q",
			response.Header().Get("Content-Disposition"), wantDisposition)
	}
	if response.Body.String() != "signed pass" {
		t.Errorf("body = %q", response.Body.String())
	}
	mockSettings.AssertExpectations(t)
}

func TestAppleWalletPassFilename(t *testing.T) {
	tests := map[string]struct {
		hackathonName string
		want          string
	}{
		"name and year":   {hackathonName: "HackUTD 2027", want: "hackutd-2027-hacker-pass.pkpass"},
		"another school":  {hackathonName: "Pearl Hacks 2027", want: "pearl-hacks-2027-hacker-pass.pkpass"},
		"accents shed":    {hackathonName: "Hackatón México", want: "hackatn-mxico-hacker-pass.pkpass"},
		"unset":           {hackathonName: "", want: defaultAppleWalletPassFilename},
		"no ascii at all": {hackathonName: "日本ハッカソン", want: defaultAppleWalletPassFilename},
	}

	for testName, tt := range tests {
		t.Run(testName, func(t *testing.T) {
			if got := appleWalletPassFilename(tt.hackathonName); got != tt.want {
				t.Errorf("appleWalletPassFilename(%q) = %q, want %q", tt.hackathonName, got, tt.want)
			}
		})
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
