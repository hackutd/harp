package main

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

// cfAccessJWTHeader is the header Cloudflare Access adds to every request it
// lets through to the origin, carrying a JWT signed by the team's keys.
const cfAccessJWTHeader = "Cf-Access-Jwt-Assertion"

// cfAccessConfig describes the Cloudflare Access application in front of this
// service. Staging requires it: Access only guards traffic that goes through
// Cloudflare, and Cloud Run still answers on its run.app URL (and on Google's
// frontend for the mapped domain), so the origin has to check for itself that
// a request came through Access.
type cfAccessConfig struct {
	// teamDomain is the Zero Trust team domain, e.g. acmutd.cloudflareaccess.com.
	teamDomain string
	// aud is the Application Audience (AUD) tag of the Access application.
	aud string
}

func (c cfAccessConfig) configured() bool {
	return c.teamDomain != "" && c.aud != ""
}

// issuer is the iss claim Cloudflare puts in Access tokens for this team.
func (c cfAccessConfig) issuer() string {
	return "https://" + c.teamDomain
}

// normalizeCFAccessTeamDomain accepts the team domain with or without a scheme
// or trailing slash, since the dashboard shows it both ways.
func normalizeCFAccessTeamDomain(raw string) string {
	domain := strings.TrimSpace(raw)
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	return strings.TrimSuffix(domain, "/")
}

// newCFAccessKeyfunc fetches the team's signing keys and keeps them fresh.
// Cloudflare rotates them periodically, so unknown key IDs trigger a refetch.
func newCFAccessKeyfunc(cfg cfAccessConfig, onRefreshError func(error)) (jwt.Keyfunc, error) {
	jwks, err := keyfunc.Get(cfg.issuer()+"/cdn-cgi/access/certs", keyfunc.Options{
		RefreshInterval:     time.Hour,
		RefreshRateLimit:    5 * time.Minute,
		RefreshTimeout:      10 * time.Second,
		RefreshUnknownKID:   true,
		RefreshErrorHandler: onRefreshError,
	})
	if err != nil {
		return nil, fmt.Errorf("fetch cloudflare access certs: %w", err)
	}
	return jwks.Keyfunc, nil
}

// verifyCFAccessToken checks that token was issued by this team's Access for
// this application and has not expired.
func verifyCFAccessToken(token string, cfg cfAccessConfig, keys jwt.Keyfunc) error {
	if token == "" {
		return errors.New("missing " + cfAccessJWTHeader + " header")
	}
	_, err := jwt.Parse(token, keys,
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithAudience(cfg.aud),
		jwt.WithIssuer(cfg.issuer()),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return fmt.Errorf("invalid cloudflare access token: %w", err)
	}
	return nil
}

// CFAccessMiddleware rejects any request that did not pass through the
// Cloudflare Access application in front of this service.
func (app *application) CFAccessMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := verifyCFAccessToken(r.Header.Get(cfAccessJWTHeader), app.config.cfAccess, app.cfAccessKeys); err != nil {
			app.forbiddenResponse(w, r, err)
			return
		}
		next.ServeHTTP(w, r)
	})
}
