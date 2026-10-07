package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const (
	dirTargetID  = "22222222-2222-2222-2222-222222222222"
	dirMissingID = "99999999-9999-9999-9999-999999999999"
)

func withDirectoryUserParam(req *http.Request, userID string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("userID", userID)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func directoryJSONRequest(t *testing.T, method string, body any) *http.Request {
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

func testDirectoryProfile(userID string) *store.DirectoryProfile {
	return &store.DirectoryProfile{
		UserID:            userID,
		DisplayName:       "Alice",
		Intent:            store.DirectoryIntentLookingForTeammates,
		Discoverable:      true,
		Skills:            store.StringArray{},
		InterestTags:      store.StringArray{},
		RolesLookingFor:   store.StringArray{},
		StatusConfirmedAt: time.Now(),
	}
}

// mockDirectoryViewer stubs the settings a card query reads.
func mockDirectoryViewer(settings *store.MockSettingsStore) {
	settings.On("GetScanTypes").Return([]store.ScanType{
		{Name: "check_in", Category: store.ScanCategoryCheckIn, IsActive: true},
		{Name: "lunch", Category: store.ScanCategoryMeal, IsActive: true},
	}, nil).Maybe()
	settings.On("GetHackathonDateRange").Return(store.HackathonDateRange{}, nil).Maybe()
}

func TestDirectoryEventNear(t *testing.T) {
	start, end := "2026-11-14", "2026-11-15"
	dr := store.HackathonDateRange{StartDate: &start, EndDate: &end}

	assert.False(t, directoryEventNear(store.HackathonDateRange{}, time.Now()))
	assert.False(t, directoryEventNear(dr, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC)))
	assert.True(t, directoryEventNear(dr, time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)))
	assert.True(t, directoryEventNear(dr, time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)))
	assert.False(t, directoryEventNear(dr, time.Date(2026, 11, 17, 0, 0, 0, 0, time.UTC)))
}

func TestDirectoryHeadshotObjectOwner(t *testing.T) {
	owner, ok := directoryHeadshotObjectOwner("hackathons/hackutd-2026/directory-headshots/user-1/0123456789abcdef0123456789abcdef.webp")
	assert.True(t, ok)
	assert.Equal(t, "user-1", owner)

	for _, bad := range []string{
		"hackathons/hackutd-2026/travel-receipts/user-1/0123456789abcdef0123456789abcdef.png",
		"hackathons/hackutd-2026/directory-headshots/user-1/short.png",
		"hackathons/hackutd-2026/directory-headshots/user-1/0123456789abcdef0123456789abcdef.pdf",
		"elsewhere/directory-headshots/user-1/0123456789abcdef0123456789abcdef.png",
	} {
		_, ok := directoryHeadshotObjectOwner(bad)
		assert.False(t, ok, bad)
	}
}

func TestGetMyDirectoryProfile(t *testing.T) {
	t.Run("reports ineligible users without a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		apps := app.store.Application.(*store.MockApplicationStore)

		dir.On("IsEligible", "user-1").Return(false, nil).Once()
		dir.On("GetProfile", "user-1").Return(nil, store.ErrNotFound).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{"AI/ML"}, nil).Once()
		mockDirectoryViewer(settings)
		apps.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodGet, nil), http.HandlerFunc(app.getMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryMeResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.False(t, body.Data.Eligible)
		assert.Nil(t, body.Data.Profile)
		assert.Equal(t, []string{"AI/ML"}, body.Data.Options.InterestTags)
	})

	t.Run("flags a stale status close to the event", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		apps := app.store.Application.(*store.MockApplicationStore)

		today := time.Now().Format(time.DateOnly)
		profile := testDirectoryProfile("user-1")
		profile.StatusConfirmedAt = time.Now().Add(-4 * 24 * time.Hour)

		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(profile, nil).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{}, nil).Once()
		settings.On("GetHackathonDateRange").Return(store.HackathonDateRange{StartDate: &today}, nil).Once()
		apps.On("GetByUserID", "user-1").Return(&store.Application{RSVPResponses: json.RawMessage(`{"discord_username":" alice#1 "}`)}, nil).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodGet, nil), http.HandlerFunc(app.getMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryMeResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.EventNear)
		assert.True(t, body.Data.StatusStale)
		require.NotNil(t, body.Data.RSVPDiscordUsername)
		assert.Equal(t, "alice#1", *body.Data.RSVPDiscordUsername)
	})
}

func TestUpsertMyDirectoryProfile(t *testing.T) {
	valid := map[string]any{
		"display_name":  "  Alice  ",
		"skills":        []string{"Go", " ", "React"},
		"interest_tags": []string{"AI/ML"},
		"intent":        "looking_for_teammates",
		"spots_needed":  2,
	}

	t.Run("rejects hackers without a confirmed RSVP", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(false, nil).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPut, valid), http.HandlerFunc(app.upsertMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		dir.AssertNotCalled(t, "UpsertProfile", mock.Anything)
	})

	t.Run("rejects tags outside the fixed list", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{"Web Dev"}, nil).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPut, valid), http.HandlerFunc(app.upsertMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("requires spots_needed for a partial team", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{"AI/ML"}, nil).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPut, map[string]any{
			"display_name": "Alice", "intent": "partial_team",
		}), http.HandlerFunc(app.upsertMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("rejects a headshot path owned by someone else", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(nil, store.ErrNotFound).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{"AI/ML"}, nil).Once()

		body := map[string]any{
			"display_name":  "Alice",
			"intent":        "team_set",
			"headshot_path": "hackathons/h/directory-headshots/user-2/0123456789abcdef0123456789abcdef.png",
		}
		rr := executeRequest(directoryJSONRequest(t, http.MethodPut, body), http.HandlerFunc(app.upsertMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("normalizes and saves the card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		apps := app.store.Application.(*store.MockApplicationStore)

		dir.On("IsEligible", "user-1").Return(true, nil)
		settings.On("GetDirectoryInterestTags").Return([]string{"AI/ML"}, nil)
		mockDirectoryViewer(settings)
		dir.On("GetProfile", "user-1").Return(nil, store.ErrNotFound).Once()
		dir.On("UpsertProfile", mock.MatchedBy(func(p *store.DirectoryProfile) bool {
			return p.DisplayName == "Alice" &&
				assert.ObjectsAreEqual(store.StringArray{"Go", "React"}, store.StringArray(p.Skills)) &&
				p.SpotsNeeded == nil && p.Discoverable
		})).Return(testDirectoryProfile("user-1"), nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		apps.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPut, valid), http.HandlerFunc(app.upsertMyDirectoryProfileHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})
}

func TestListDirectory(t *testing.T) {
	t.Run("requires your own card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(nil, store.ErrNotFound).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodGet, nil), http.HandlerFunc(app.listDirectoryHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		assert.Contains(t, rr.Body.String(), "create your directory card")
	})

	t.Run("passes filters and check-in types through", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		mockDirectoryViewer(settings)

		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		dir.On("List", mock.MatchedBy(func(v store.DirectoryViewer) bool {
			return v.UserID == "user-1" && len(v.CheckInTypes) == 1 && v.CheckInTypes[0] == "check_in" && v.StaleCutoff == nil
		}), store.DirectoryFilters{
			Intents:      []store.DirectoryIntent{store.DirectoryIntentPartialTeam},
			InterestTags: []string{"AI/ML", "Web Dev"},
			Search:       "go",
			CheckedIn:    true,
		}, (*store.DirectoryCursor)(nil), directoryPageSize).Return(&store.DirectoryListResult{Cards: []store.DirectoryCard{{UserID: dirTargetID}}}, nil).Once()

		req := httptest.NewRequest(http.MethodGet, "/?intent=partial_team&tags=AI/ML,Web%20Dev&q=go&checked_in=true", nil)
		req = setUserContext(req, newTestUser())
		rr := executeRequest(req, http.HandlerFunc(app.listDirectoryHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})

	t.Run("rejects unknown intents", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()

		req := setUserContext(httptest.NewRequest(http.MethodGet, "/?intent=nope", nil), newTestUser())
		rr := executeRequest(req, http.HandlerFunc(app.listDirectoryHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestPokeDirectoryProfile(t *testing.T) {
	setup := func(t *testing.T, target *store.DirectoryTarget) (*application, *store.MockAttendeeDirectoryStore) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		mockDirectoryViewer(app.store.Settings.(*store.MockSettingsStore))
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		if target != nil {
			dir.On("GetTarget", "user-1", dirTargetID).Return(target, nil).Once()
		}
		return app, dir
	}
	poke := func(app *application) *httptest.ResponseRecorder {
		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPost, nil), dirTargetID)
		req = setUserContext(req, newTestUser())
		return executeRequest(req, http.HandlerFunc(app.pokeDirectoryProfileHandler))
	}

	t.Run("blocks undiscoverable targets", func(t *testing.T) {
		app, dir := setup(t, &store.DirectoryTarget{Discoverable: false, Eligible: true})
		rr := poke(app)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		dir.AssertNotCalled(t, "Poke", mock.Anything, mock.Anything)
	})

	t.Run("treats moderated targets as missing", func(t *testing.T) {
		app, _ := setup(t, &store.DirectoryTarget{Discoverable: true, Eligible: true, ModerationHidden: true})
		checkResponseCode(t, http.StatusNotFound, poke(app).Code)
	})

	t.Run("lets you poke back an undiscoverable poker into a match", func(t *testing.T) {
		app, dir := setup(t, &store.DirectoryTarget{Discoverable: false, Eligible: true, PokedViewer: true})
		dir.On("Poke", "user-1", dirTargetID).Return(&store.PokeResult{Created: true, Matched: true}, nil).Once()
		discordID := "123"
		dir.On("GetCard", mock.Anything, dirTargetID).Return(&store.DirectoryCard{
			UserID: dirTargetID, DisplayName: "Bob", Matched: true, DiscordUserID: &discordID,
		}, nil).Once()

		rr := poke(app)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryPokeResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Matched)
		require.NotNil(t, body.Data.Card.DiscordUserID)
		assert.Equal(t, "123", *body.Data.Card.DiscordUserID)
		dir.AssertExpectations(t)
	})

	t.Run("blocks a moderated poker", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		moderated := testDirectoryProfile("user-1")
		moderated.ModerationHidden = true
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(moderated, nil).Once()

		checkResponseCode(t, http.StatusForbidden, poke(app).Code)
	})

	t.Run("rejects poking yourself", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		self := newTestUser()
		self.ID = dirTargetID
		dir.On("IsEligible", dirTargetID).Return(true, nil).Once()
		dir.On("GetProfile", dirTargetID).Return(testDirectoryProfile(dirTargetID), nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPost, nil), dirTargetID)
		req = setUserContext(req, self)
		rr := executeRequest(req, http.HandlerFunc(app.pokeDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		dir.AssertNotCalled(t, "Poke", mock.Anything, mock.Anything)
	})
}

func TestAddDirectoryContact(t *testing.T) {
	t.Run("blocks undiscoverable targets", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		dir.On("GetTarget", "user-1", dirTargetID).Return(&store.DirectoryTarget{Discoverable: false, Eligible: true}, nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPut, nil), dirTargetID)
		req = setUserContext(req, newTestUser())
		rr := executeRequest(req, http.HandlerFunc(app.addDirectoryContactHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)
		dir.AssertNotCalled(t, "AddContact", mock.Anything, mock.Anything)
	})
}

func TestModerateDirectoryProfile(t *testing.T) {
	t.Run("hides a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		reason := "spam"
		dir.On("SetModeration", dirTargetID, "admin-1", true, &reason).Return(nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{"hidden": true, "reason": " spam "}), dirTargetID)
		req = setUserContext(req, newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.moderateDirectoryProfileHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)
		dir.AssertExpectations(t)
	})

	t.Run("404s for a missing card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("SetModeration", dirMissingID, "admin-1", false, (*string)(nil)).Return(store.ErrNotFound).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{"hidden": false}), dirMissingID)
		req = setUserContext(req, newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.moderateDirectoryProfileHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	t.Run("requires hidden", func(t *testing.T) {
		app := newTestApplication(t)
		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{}), dirTargetID)
		req = setUserContext(req, newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.moderateDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestLinkDiscord(t *testing.T) {
	discord := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth2/token":
			require.NoError(t, r.ParseForm())
			assert.Equal(t, "the-code", r.Form.Get("code"))
			_, _ = w.Write([]byte(`{"access_token":"tok","token_type":"Bearer"}`))
		case "/users/@me":
			assert.Equal(t, "Bearer tok", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"id":"80351110224678912","username":"alice"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer discord.Close()

	newApp := func(t *testing.T) *application {
		app := newTestApplication(t)
		app.config.discord = discordConfig{clientID: "cid", clientSecret: "secret", apiBaseURL: discord.URL}
		app.config.frontendURL = "http://localhost:3000"
		return app
	}

	t.Run("rejects a mismatched state", func(t *testing.T) {
		app := newApp(t)
		req := directoryJSONRequest(t, http.MethodPost, map[string]string{"code": "the-code", "state": "abc"})
		req.AddCookie(&http.Cookie{Name: discordOAuthStateCookie, Value: "xyz"})
		rr := executeRequest(req, http.HandlerFunc(app.linkDiscordHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("stores the Discord identity", func(t *testing.T) {
		app := newApp(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		apps := app.store.Application.(*store.MockApplicationStore)

		id, name := "80351110224678912", "alice"
		dir.On("SetDiscord", "user-1", &id, &name).Return(nil).Once()
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		settings.On("GetDirectoryInterestTags").Return([]string{}, nil).Once()
		mockDirectoryViewer(settings)
		apps.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()

		req := directoryJSONRequest(t, http.MethodPost, map[string]string{"code": "the-code", "state": "abc"})
		req.AddCookie(&http.Cookie{Name: discordOAuthStateCookie, Value: "abc"})
		rr := executeRequest(req, http.HandlerFunc(app.linkDiscordHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})

	t.Run("authorize URL asks for identify and sets state", func(t *testing.T) {
		app := newApp(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodGet, nil), http.HandlerFunc(app.getDiscordAuthorizeURLHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), "scope=identify")
		assert.Contains(t, rr.Body.String(), "app%2Fdirectory%2Fdiscord%2Fcallback")
		assert.Contains(t, rr.Header().Get("Set-Cookie"), discordOAuthStateCookie)
	})
}

// directoryAccess stubs requireDirectoryAccess for user-1 with a card.
func directoryAccess(dir *store.MockAttendeeDirectoryStore) {
	dir.On("IsEligible", "user-1").Return(true, nil).Once()
	dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
}

// mockDirectoryMe stubs everything buildDirectoryMe reads after a write.
func mockDirectoryMe(app *application, profile *store.DirectoryProfile) {
	dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
	settings := app.store.Settings.(*store.MockSettingsStore)
	apps := app.store.Application.(*store.MockApplicationStore)
	dir.On("IsEligible", "user-1").Return(true, nil).Once()
	dir.On("GetProfile", "user-1").Return(profile, nil).Once()
	settings.On("GetDirectoryInterestTags").Return([]string{}, nil).Once()
	mockDirectoryViewer(settings)
	apps.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()
}

func TestDirectoryUserIDParam(t *testing.T) {
	handlers := map[string]func(*application) http.HandlerFunc{
		"poke":           func(a *application) http.HandlerFunc { return a.pokeDirectoryProfileHandler },
		"add contact":    func(a *application) http.HandlerFunc { return a.addDirectoryContactHandler },
		"remove contact": func(a *application) http.HandlerFunc { return a.removeDirectoryContactHandler },
		"hide":           func(a *application) http.HandlerFunc { return a.hideDirectoryProfileHandler },
		"unhide":         func(a *application) http.HandlerFunc { return a.unhideDirectoryProfileHandler },
		"moderate":       func(a *application) http.HandlerFunc { return a.moderateDirectoryProfileHandler },
	}
	for name, handler := range handlers {
		t.Run(name+" rejects a non-UUID user ID before touching the store", func(t *testing.T) {
			app := newTestApplication(t)
			dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)

			req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPost, map[string]any{"hidden": true}), "not-a-uuid")
			req = setUserContext(req, newAdminUser())
			rr := executeRequest(req, handler(app))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
			assert.Contains(t, rr.Body.String(), "invalid user ID")
			dir.AssertExpectations(t)
		})
	}
}

func TestListDirectoryCursor(t *testing.T) {
	t.Run("pins the stale cutoff from the first page", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		mockDirectoryViewer(settings)
		directoryAccess(dir)

		cutoff := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
		cursor := store.DirectoryCursor{StatusConfirmedAt: cutoff.Add(time.Hour), UserID: dirTargetID, StaleCutoff: &cutoff}
		dir.On("List", mock.MatchedBy(func(v store.DirectoryViewer) bool {
			return v.StaleCutoff != nil && v.StaleCutoff.Equal(cutoff)
		}), mock.Anything, mock.MatchedBy(func(c *store.DirectoryCursor) bool {
			return c != nil && c.UserID == dirTargetID
		}), directoryPageSize).Return(&store.DirectoryListResult{Cards: []store.DirectoryCard{}}, nil).Once()

		req := httptest.NewRequest(http.MethodGet, "/?cursor="+store.EncodeDirectoryCursor(cursor), nil)
		rr := executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(app.listDirectoryHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})

	for name, raw := range map[string]string{
		"garbage":         "not!base64",
		"non-UUID id":     store.EncodeDirectoryCursor(store.DirectoryCursor{StatusConfirmedAt: time.Now(), UserID: "x"}),
		"missing sort":    store.EncodeDirectoryCursor(store.DirectoryCursor{UserID: dirTargetID}),
		"limit too large": "",
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			app := newTestApplication(t)
			dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
			directoryAccess(dir)

			url := "/?cursor=" + raw
			if raw == "" {
				url = "/?limit=61"
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rr := executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(app.listDirectoryHandler))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
			dir.AssertNotCalled(t, "List", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
}

func TestUpdateMyDirectoryDiscoverable(t *testing.T) {
	t.Run("hides the card and returns the refreshed state", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("SetDiscoverable", "user-1", false).Return(nil).Once()
		hidden := testDirectoryProfile("user-1")
		hidden.Discoverable = false
		mockDirectoryMe(app, hidden)

		rr := executeRequest(directoryJSONRequest(t, http.MethodPatch, map[string]any{"discoverable": false}),
			http.HandlerFunc(app.updateMyDirectoryDiscoverableHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryMeResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		require.NotNil(t, body.Data.Profile)
		assert.False(t, body.Data.Profile.Discoverable)
		dir.AssertExpectations(t)
	})

	t.Run("404s without a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("SetDiscoverable", "user-1", true).Return(store.ErrNotFound).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPatch, map[string]any{"discoverable": true}),
			http.HandlerFunc(app.updateMyDirectoryDiscoverableHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	t.Run("requires discoverable", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)

		rr := executeRequest(directoryJSONRequest(t, http.MethodPatch, map[string]any{}),
			http.HandlerFunc(app.updateMyDirectoryDiscoverableHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
		dir.AssertNotCalled(t, "SetDiscoverable", mock.Anything, mock.Anything)
	})
}

func TestConfirmMyDirectoryStatus(t *testing.T) {
	t.Run("re-confirms and returns the refreshed state", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("ConfirmStatus", "user-1").Return(nil).Once()
		mockDirectoryMe(app, testDirectoryProfile("user-1"))

		rr := executeRequest(directoryJSONRequest(t, http.MethodPost, nil), http.HandlerFunc(app.confirmMyDirectoryStatusHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})

	t.Run("404s without a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("ConfirmStatus", "user-1").Return(store.ErrNotFound).Once()

		rr := executeRequest(directoryJSONRequest(t, http.MethodPost, nil), http.HandlerFunc(app.confirmMyDirectoryStatusHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})
}

func TestGenerateDirectoryHeadshotUploadURL(t *testing.T) {
	upload := func(app *application, contentType string) *httptest.ResponseRecorder {
		req := directoryJSONRequest(t, http.MethodPost, map[string]string{"content_type": contentType})
		return executeRequest(req, http.HandlerFunc(app.generateDirectoryHeadshotUploadURLHandler))
	}

	t.Run("returns a signed URL for a path the owner can save", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)

		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		settings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()
		mockGCS.On("GenerateImageUploadURL", mock.Anything, mock.MatchedBy(func(p string) bool {
			return strings.HasPrefix(p, "hackathons/hackutd-2026/directory-headshots/user-1/") && strings.HasSuffix(p, ".webp")
		}), "image/webp").Return("https://upload.example.com", nil).Once()

		rr := upload(app, "image/webp")
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryHeadshotUploadURLResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, "https://upload.example.com", body.Data.UploadURL)
		owner, ok := directoryHeadshotObjectOwner(body.Data.HeadshotPath)
		assert.True(t, ok)
		assert.Equal(t, "user-1", owner)
		mockGCS.AssertExpectations(t)
	})

	t.Run("rejects hackers without a confirmed RSVP", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(false, nil).Once()

		checkResponseCode(t, http.StatusForbidden, upload(app, "image/png").Code)
	})

	t.Run("rejects unsupported image types", func(t *testing.T) {
		app := newTestApplication(t)
		checkResponseCode(t, http.StatusBadRequest, upload(app, "image/gif").Code)
	})

	t.Run("returns 503 when GCS is not configured", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		app.gcsClient = nil

		checkResponseCode(t, http.StatusServiceUnavailable, upload(app, "image/png").Code)
	})

	t.Run("returns 500 when signing fails", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		settings := app.store.Settings.(*store.MockSettingsStore)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		settings.On("GetHackathonName").Return("HackUTD", nil).Once()
		mockGCS.On("GenerateImageUploadURL", mock.Anything, mock.Anything, "image/png").Return("", assert.AnError).Once()

		checkResponseCode(t, http.StatusInternalServerError, upload(app, "image/png").Code)
	})
}

func TestHideDirectoryProfile(t *testing.T) {
	hide := func(app *application, method string, handler func(http.ResponseWriter, *http.Request), target string) *httptest.ResponseRecorder {
		req := withDirectoryUserParam(directoryJSONRequest(t, method, nil), target)
		return executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(handler))
	}

	t.Run("hides a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		directoryAccess(dir)
		dir.On("GetTarget", "user-1", dirTargetID).Return(&store.DirectoryTarget{Discoverable: true, Eligible: true}, nil).Once()
		dir.On("Hide", "user-1", dirTargetID).Return(nil).Once()

		checkResponseCode(t, http.StatusNoContent, hide(app, http.MethodPut, app.hideDirectoryProfileHandler, dirTargetID).Code)
		dir.AssertExpectations(t)
	})

	t.Run("404s for a missing card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		directoryAccess(dir)
		dir.On("GetTarget", "user-1", dirMissingID).Return(nil, store.ErrNotFound).Once()

		checkResponseCode(t, http.StatusNotFound, hide(app, http.MethodPut, app.hideDirectoryProfileHandler, dirMissingID).Code)
		dir.AssertNotCalled(t, "Hide", mock.Anything, mock.Anything)
	})

	t.Run("unhides a card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		directoryAccess(dir)
		dir.On("Unhide", "user-1", dirTargetID).Return(nil).Once()

		checkResponseCode(t, http.StatusNoContent, hide(app, http.MethodDelete, app.unhideDirectoryProfileHandler, dirTargetID).Code)
		dir.AssertExpectations(t)
	})

	t.Run("requires your own card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(nil, store.ErrNotFound).Once()

		checkResponseCode(t, http.StatusForbidden, hide(app, http.MethodPut, app.hideDirectoryProfileHandler, dirTargetID).Code)
	})
}

func TestDirectoryContacts(t *testing.T) {
	t.Run("adds a contact and returns the card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		mockDirectoryViewer(app.store.Settings.(*store.MockSettingsStore))
		directoryAccess(dir)
		dir.On("GetTarget", "user-1", dirTargetID).Return(&store.DirectoryTarget{Discoverable: true, Eligible: true}, nil).Once()
		dir.On("AddContact", "user-1", dirTargetID).Return(nil).Once()
		dir.On("GetCard", mock.Anything, dirTargetID).Return(&store.DirectoryCard{UserID: dirTargetID, IsContact: true}, nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPut, nil), dirTargetID)
		rr := executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(app.addDirectoryContactHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryCardResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.True(t, body.Data.Card.IsContact)
		dir.AssertExpectations(t)
	})

	t.Run("removes a contact", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		directoryAccess(dir)
		dir.On("RemoveContact", "user-1", dirTargetID).Return(nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodDelete, nil), dirTargetID)
		rr := executeRequest(setUserContext(req, newTestUser()), http.HandlerFunc(app.removeDirectoryContactHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)
		dir.AssertExpectations(t)
	})

	listCases := map[string]struct {
		method  string
		handler func(*application) http.HandlerFunc
	}{
		"contacts": {"ListContacts", func(a *application) http.HandlerFunc { return a.listDirectoryContactsHandler }},
		"pokes":    {"ListPokedMe", func(a *application) http.HandlerFunc { return a.listDirectoryPokesHandler }},
	}
	for name, tc := range listCases {
		t.Run("lists "+name+" with signed headshots", func(t *testing.T) {
			app := newTestApplication(t)
			dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
			mockGCS := app.gcsClient.(*gcs.MockClient)
			mockDirectoryViewer(app.store.Settings.(*store.MockSettingsStore))
			directoryAccess(dir)

			path := "hackathons/h/directory-headshots/" + dirTargetID + "/a.png"
			picture := "https://lh3.example.com/p.png"
			dir.On(tc.method, mock.MatchedBy(func(v store.DirectoryViewer) bool { return v.UserID == "user-1" })).Return([]store.DirectoryCard{
				{UserID: dirTargetID, HeadshotPath: &path},
				{UserID: dirMissingID, ProfilePictureURL: &picture},
			}, nil).Once()
			mockGCS.On("GenerateDownloadURL", mock.Anything, path).Return("https://signed.example.com/a", nil).Once()

			req := setUserContext(httptest.NewRequest(http.MethodGet, "/", nil), newTestUser())
			rr := executeRequest(req, tc.handler(app))
			checkResponseCode(t, http.StatusOK, rr.Code)

			var body struct {
				Data DirectoryCardsResponse `json:"data"`
			}
			require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
			require.Len(t, body.Data.Cards, 2)
			require.NotNil(t, body.Data.Cards[0].HeadshotURL)
			assert.Equal(t, "https://signed.example.com/a", *body.Data.Cards[0].HeadshotURL)
			require.NotNil(t, body.Data.Cards[1].HeadshotURL)
			assert.Equal(t, picture, *body.Data.Cards[1].HeadshotURL)
			dir.AssertExpectations(t)
			mockGCS.AssertExpectations(t)
		})

		t.Run("lists "+name+" only with your own card", func(t *testing.T) {
			app := newTestApplication(t)
			dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
			dir.On("IsEligible", "user-1").Return(false, nil).Once()

			req := setUserContext(httptest.NewRequest(http.MethodGet, "/", nil), newTestUser())
			checkResponseCode(t, http.StatusForbidden, executeRequest(req, tc.handler(app)).Code)
		})
	}
}

func TestDirectoryHeadshotSigning(t *testing.T) {
	t.Run("reuses a signed URL instead of signing again", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		path := "hackathons/h/directory-headshots/u/a.png"
		mockGCS.On("GenerateDownloadURL", mock.Anything, path).Return("https://signed.example.com/a", nil).Once()

		first := app.headshotURL(context.Background(), &path, nil)
		second := app.headshotURL(context.Background(), &path, nil)
		require.NotNil(t, first)
		require.NotNil(t, second)
		assert.Equal(t, *first, *second)
		mockGCS.AssertExpectations(t)
	})

	t.Run("re-signs once the cached URL expires", func(t *testing.T) {
		var cache signedURLCache
		now := time.Now()
		cache.put("p", "old", now)
		_, ok := cache.get("p", now.Add(headshotURLCacheTTL-time.Second))
		assert.True(t, ok)
		_, ok = cache.get("p", now.Add(headshotURLCacheTTL))
		assert.False(t, ok)
	})

	t.Run("falls back to the profile picture when signing fails", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		path := "hackathons/h/directory-headshots/u/a.png"
		picture := "https://lh3.example.com/p.png"
		mockGCS.On("GenerateDownloadURL", mock.Anything, path).Return("", assert.AnError).Twice()

		got := app.headshotURL(context.Background(), &path, &picture)
		require.NotNil(t, got)
		assert.Equal(t, picture, *got)
		// Failures are not cached.
		app.headshotURL(context.Background(), &path, &picture)
		mockGCS.AssertExpectations(t)
	})

	t.Run("signs every card in a page", func(t *testing.T) {
		app := newTestApplication(t)
		mockGCS := app.gcsClient.(*gcs.MockClient)
		cards := make([]store.DirectoryCard, 30)
		for i := range cards {
			p := fmt.Sprintf("hackathons/h/directory-headshots/u%d/a.png", i)
			cards[i].HeadshotPath = &p
			mockGCS.On("GenerateDownloadURL", mock.Anything, p).Return("signed:"+p, nil).Once()
		}

		for i, c := range app.withHeadshots(context.Background(), cards) {
			require.NotNil(t, c.HeadshotURL, i)
			assert.Equal(t, "signed:"+*c.HeadshotPath, *c.HeadshotURL)
		}
		mockGCS.AssertExpectations(t)
	})
}

func TestListAdminDirectoryProfiles(t *testing.T) {
	t.Run("returns a page with its cursor", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		next := "next-page"
		dir.On("AdminList", "bob", (*store.DirectoryAdminCursor)(nil), directoryAdminPageSize).Return(&store.DirectoryAdminListResult{
			Profiles:   []store.DirectoryAdminProfile{{UserID: dirTargetID, Email: "bob@example.com", Skills: store.StringArray{}}},
			NextCursor: &next,
		}, nil).Once()

		req := setUserContext(httptest.NewRequest(http.MethodGet, "/?search=%20bob%20", nil), newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.listAdminDirectoryProfilesHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data DirectoryAdminListResponse `json:"data"`
		}
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		require.Len(t, body.Data.Profiles, 1)
		require.NotNil(t, body.Data.NextCursor)
		assert.Equal(t, "next-page", *body.Data.NextCursor)
		dir.AssertExpectations(t)
	})

	t.Run("passes a cursor and limit through", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		created := time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)
		cursor := store.EncodeDirectoryAdminCursor(store.DirectoryAdminCursor{CreatedAt: created, UserID: dirTargetID})
		dir.On("AdminList", "", mock.MatchedBy(func(c *store.DirectoryAdminCursor) bool {
			return c != nil && c.UserID == dirTargetID && c.CreatedAt.Equal(created)
		}), 10).Return(&store.DirectoryAdminListResult{Profiles: []store.DirectoryAdminProfile{}}, nil).Once()

		req := setUserContext(httptest.NewRequest(http.MethodGet, "/?limit=10&cursor="+cursor, nil), newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.listAdminDirectoryProfilesHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)
		dir.AssertExpectations(t)
	})

	for name, query := range map[string]string{
		"limit of 0":         "?limit=0",
		"limit over 100":     "?limit=101",
		"non-numeric limit":  "?limit=ten",
		"garbage cursor":     "?cursor=%25%25",
		"non-UUID cursor id": "?cursor=" + store.EncodeDirectoryAdminCursor(store.DirectoryAdminCursor{CreatedAt: time.Now(), UserID: "x"}),
		"search too long":    "?search=" + strings.Repeat("a", 101),
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			app := newTestApplication(t)
			dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)

			req := setUserContext(httptest.NewRequest(http.MethodGet, "/"+query, nil), newAdminUser())
			rr := executeRequest(req, http.HandlerFunc(app.listAdminDirectoryProfilesHandler))
			checkResponseCode(t, http.StatusBadRequest, rr.Code)
			dir.AssertNotCalled(t, "AdminList", mock.Anything, mock.Anything, mock.Anything)
		})
	}

	t.Run("returns 500 when the store fails", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("AdminList", "", (*store.DirectoryAdminCursor)(nil), directoryAdminPageSize).Return(nil, assert.AnError).Once()

		req := setUserContext(httptest.NewRequest(http.MethodGet, "/", nil), newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.listAdminDirectoryProfilesHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)
	})
}
