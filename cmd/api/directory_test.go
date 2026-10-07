package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
		}, (*store.DirectoryCursor)(nil), directoryPageSize).Return(&store.DirectoryListResult{Cards: []store.DirectoryCard{{UserID: "user-2"}}}, nil).Once()

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
			dir.On("GetTarget", "user-1", "user-2").Return(target, nil).Once()
		}
		return app, dir
	}
	poke := func(app *application) *httptest.ResponseRecorder {
		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPost, nil), "user-2")
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
		dir.On("Poke", "user-1", "user-2").Return(&store.PokeResult{Created: true, Matched: true}, nil).Once()
		discordID := "123"
		dir.On("GetCard", mock.Anything, "user-2").Return(&store.DirectoryCard{
			UserID: "user-2", DisplayName: "Bob", Matched: true, DiscordUserID: &discordID,
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
		app, _ := setup(t, nil)
		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPost, nil), "user-1")
		req = setUserContext(req, newTestUser())
		rr := executeRequest(req, http.HandlerFunc(app.pokeDirectoryProfileHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestAddDirectoryContact(t *testing.T) {
	t.Run("blocks undiscoverable targets", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("IsEligible", "user-1").Return(true, nil).Once()
		dir.On("GetProfile", "user-1").Return(testDirectoryProfile("user-1"), nil).Once()
		dir.On("GetTarget", "user-1", "user-2").Return(&store.DirectoryTarget{Discoverable: false, Eligible: true}, nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPut, nil), "user-2")
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
		dir.On("SetModeration", "user-2", "admin-1", true, &reason).Return(nil).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{"hidden": true, "reason": " spam "}), "user-2")
		req = setUserContext(req, newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.moderateDirectoryProfileHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)
		dir.AssertExpectations(t)
	})

	t.Run("404s for a missing card", func(t *testing.T) {
		app := newTestApplication(t)
		dir := app.store.AttendeeDirectory.(*store.MockAttendeeDirectoryStore)
		dir.On("SetModeration", "user-9", "admin-1", false, (*string)(nil)).Return(store.ErrNotFound).Once()

		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{"hidden": false}), "user-9")
		req = setUserContext(req, newAdminUser())
		rr := executeRequest(req, http.HandlerFunc(app.moderateDirectoryProfileHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)
	})

	t.Run("requires hidden", func(t *testing.T) {
		app := newTestApplication(t)
		req := withDirectoryUserParam(directoryJSONRequest(t, http.MethodPatch, map[string]any{}), "user-2")
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
