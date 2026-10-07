package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/hackutd/harp/internal/store"
)

const (
	discordOAuthStateCookie = "harp_discord_oauth_state"
	discordOAuthStateTTL    = 10 * time.Minute
	discordDefaultAPIBase   = "https://discord.com/api"
	discordAuthorizeURL     = "https://discord.com/oauth2/authorize"
	discordResponseBodyCap  = 1 << 16
)

type discordConfig struct {
	clientID     string
	clientSecret string
	// apiBaseURL is overridable so tests can stand in for Discord.
	apiBaseURL string
}

var discordHTTPClient = &http.Client{Timeout: 10 * time.Second}

type DiscordAuthorizeResponse struct {
	URL string `json:"url"`
}

type LinkDiscordPayload struct {
	Code  string `json:"code" validate:"required,max=512"`
	State string `json:"state" validate:"required,max=128"`
}

func (app *application) discordOAuthEnabled() bool {
	return app.config.discord.clientID != "" && app.config.discord.clientSecret != ""
}

func (app *application) discordRedirectURI() string {
	return strings.TrimRight(app.config.frontendURL, "/") + "/app/directory/discord/callback"
}

func (app *application) discordAPIBase() string {
	if app.config.discord.apiBaseURL != "" {
		return strings.TrimRight(app.config.discord.apiBaseURL, "/")
	}
	return discordDefaultAPIBase
}

// getDiscordAuthorizeURLHandler starts linking a Discord account to the caller's card.
//
//	@Summary		Start Discord linking
//	@Description	Returns the Discord OAuth2 authorize URL (identify scope) and sets a short-lived state cookie. Discord redirects back to the portal, which completes the link with POST /directory/me/discord.
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	DiscordAuthorizeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Failure		503	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/discord/authorize [get]
func (app *application) getDiscordAuthorizeURLHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	if !app.discordOAuthEnabled() {
		writeJSONError(w, http.StatusServiceUnavailable, "discord linking is not configured")
		return
	}
	if _, err := app.store.AttendeeDirectory.GetProfile(r.Context(), user.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	state, err := randomHex(16)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     discordOAuthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   int(discordOAuthStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   strings.HasPrefix(app.config.frontendURL, "https://"),
		SameSite: http.SameSiteLaxMode,
	})

	q := url.Values{}
	q.Set("client_id", app.config.discord.clientID)
	q.Set("redirect_uri", app.discordRedirectURI())
	q.Set("response_type", "code")
	q.Set("scope", "identify")
	q.Set("state", state)
	q.Set("prompt", "none")

	if err := app.jsonResponse(w, http.StatusOK, DiscordAuthorizeResponse{URL: discordAuthorizeURL + "?" + q.Encode()}); err != nil {
		app.internalServerError(w, r, err)
	}
}

type discordUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// exchangeDiscordCode trades an authorization code for the Discord user it belongs to.
func (app *application) exchangeDiscordCode(ctx context.Context, code string) (*discordUser, error) {
	form := url.Values{}
	form.Set("client_id", app.config.discord.clientID)
	form.Set("client_secret", app.config.discord.clientSecret)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", app.discordRedirectURI())

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, app.discordAPIBase()+"/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	var token struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := doDiscordJSON(req, &token); err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	if token.AccessToken == "" {
		return nil, errors.New("token exchange: empty access token")
	}

	req, err = http.NewRequestWithContext(ctx, http.MethodGet, app.discordAPIBase()+"/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	var du discordUser
	if err := doDiscordJSON(req, &du); err != nil {
		return nil, fmt.Errorf("fetch user: %w", err)
	}
	if du.ID == "" {
		return nil, errors.New("fetch user: empty id")
	}
	return &du, nil
}

func doDiscordJSON(req *http.Request, out any) error {
	resp, err := discordHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, discordResponseBodyCap))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord returned %d", resp.StatusCode)
	}
	return json.Unmarshal(body, out)
}

// linkDiscordHandler completes Discord linking with the code Discord redirected back with.
//
//	@Summary		Complete Discord linking
//	@Description	Exchanges the OAuth2 code for the caller's Discord user ID and username and stores them on their card. Matches get a discord.com/users/{id} deep link.
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			link	body		LinkDiscordPayload	true	"OAuth callback values"
//	@Success		200		{object}	DirectoryMeResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Failure		502		{object}	object{error=string}
//	@Failure		503		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/discord [post]
func (app *application) linkDiscordHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	if !app.discordOAuthEnabled() {
		writeJSONError(w, http.StatusServiceUnavailable, "discord linking is not configured")
		return
	}

	var req LinkDiscordPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	cookie, err := r.Cookie(discordOAuthStateCookie)
	if err != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(req.State)) != 1 {
		app.badRequestResponse(w, r, errors.New("discord link expired, please try again"))
		return
	}
	http.SetCookie(w, &http.Cookie{Name: discordOAuthStateCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})

	du, err := app.exchangeDiscordCode(r.Context(), req.Code)
	if err != nil {
		app.requestLogger(r).Warnw("discord oauth failed", "error", err.Error())
		writeJSONError(w, http.StatusBadGateway, "couldn't reach Discord, please try again")
		return
	}

	if err := app.store.AttendeeDirectory.SetDiscord(r.Context(), user.ID, &du.ID, &du.Username); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.respondDirectoryMe(w, r, user)
}

// unlinkDiscordHandler removes the linked Discord account from the caller's card.
//
//	@Summary		Unlink Discord
//	@Description	Clears the OAuth-linked Discord account. Matches fall back to the Discord username from the RSVP form.
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	DirectoryMeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/discord [delete]
func (app *application) unlinkDiscordHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	if err := app.store.AttendeeDirectory.SetDiscord(r.Context(), user.ID, nil, nil); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	app.respondDirectoryMe(w, r, user)
}
