package main

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Push services used by the browsers hackers actually show up with. Each entry
// matches the host exactly or any subdomain of it.
var defaultPushEndpointHosts = []string{
	"fcm.googleapis.com",        // Chrome, Edge, Brave, Opera, Vivaldi
	"android.googleapis.com",    // legacy Chrome
	"push.services.mozilla.com", // Firefox
	"push.apple.com",            // Safari
	"notify.windows.com",        // Edge on Windows (WNS)
	"push.samsungosp.com",       // Samsung Internet
}

const (
	pushRequestTimeout  = 10 * time.Second
	pushResponseBodyCap = 64 << 10
)

var errPushEndpointNotAllowed = errors.New("endpoint must be an https URL on a supported push service")

// parsePushEndpointHosts turns a comma-separated env value into a host suffix
// list, falling back to the built-in browser push services when empty.
func parsePushEndpointHosts(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return defaultPushEndpointHosts
	}
	var hosts []string
	for _, h := range strings.Split(raw, ",") {
		h = strings.ToLower(strings.TrimSpace(h))
		if h != "" {
			hosts = append(hosts, h)
		}
	}
	if len(hosts) == 0 {
		return defaultPushEndpointHosts
	}
	return hosts
}

// validatePushEndpoint rejects anything that is not an https URL whose host is
// (a subdomain of) an allowed push service. The dispatcher POSTs to whatever is
// stored here, so this is what keeps a hacker from pointing the server at an
// internal address.
func validatePushEndpoint(raw string, allowedHosts []string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return errPushEndpointNotAllowed
	}
	if u.Scheme != "https" || u.User != nil {
		return errPushEndpointNotAllowed
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return errPushEndpointNotAllowed
	}
	for _, allowed := range allowedHosts {
		if host == allowed || strings.HasSuffix(host, "."+allowed) {
			return nil
		}
	}
	return errPushEndpointNotAllowed
}

// newPushHTTPClient returns the client the dispatcher uses to reach push
// services: hard timeout covering connect through body read, and no redirect
// following so a push endpoint cannot bounce us somewhere else.
func newPushHTTPClient() *http.Client {
	return &http.Client{
		Timeout: pushRequestTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}
