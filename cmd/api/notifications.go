package main

import (
	"errors"
	"net/http"

	"github.com/hackutd/portal/internal/store"
)

type VapidPublicKeyResponse struct {
	PublicKey string `json:"public_key"`
}

type SubscribePushPayload struct {
	Endpoint  string `json:"endpoint" validate:"required,url"`
	P256dh    string `json:"p256dh" validate:"required"`
	Auth      string `json:"auth" validate:"required"`
	UserAgent string `json:"user_agent"`
}

type UnsubscribePushPayload struct {
	Endpoint string `json:"endpoint" validate:"required"`
}

type NotificationFeedResponse struct {
	Notifications []store.ScheduledNotification `json:"notifications"`
}

const notificationFeedLimit = 50

// getNotificationFeedHandler returns sent notifications visible to the current user.
//
//	@Summary		Get notification feed
//	@Description	Returns sent notifications targeted at the current user's role (or all roles), newest first
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	NotificationFeedResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/notifications/feed [get]
func (app *application) getNotificationFeedHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	notifications, err := app.store.ScheduledNotifications.ListSentForRole(r.Context(), user.Role, notificationFeedLimit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, NotificationFeedResponse{Notifications: notifications}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getVapidPublicKeyHandler returns the VAPID public key for push subscription.
//
//	@Summary		Get VAPID public key
//	@Description	Returns the server's VAPID public key for push notification subscription
//	@Tags			hackers
//	@Produce		json
//	@Success		200	{object}	VapidPublicKeyResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		503	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/notifications/vapid-public-key [get]
func (app *application) getVapidPublicKeyHandler(w http.ResponseWriter, r *http.Request) {
	if app.config.vapid.publicKey == "" {
		writeJSONError(w, http.StatusServiceUnavailable, "push notifications not configured")
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, VapidPublicKeyResponse{PublicKey: app.config.vapid.publicKey}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// subscribePushHandler registers a push subscription for the current user.
//
//	@Summary		Subscribe to push notifications
//	@Description	Stores a Web Push subscription for the authenticated user
//	@Tags			hackers
//	@Accept			json
//	@Produce		json
//	@Param			subscription	body	SubscribePushPayload	true	"Push subscription"
//	@Success		204
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		503	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/notifications/subscribe [post]
func (app *application) subscribePushHandler(w http.ResponseWriter, r *http.Request) {
	if app.config.vapid.publicKey == "" {
		writeJSONError(w, http.StatusServiceUnavailable, "push notifications not configured")
		return
	}

	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var payload SubscribePushPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	sub := &store.PushSubscription{
		UserID:    user.ID,
		Endpoint:  payload.Endpoint,
		P256dh:    payload.P256dh,
		Auth:      payload.Auth,
		UserAgent: payload.UserAgent,
	}

	if err := app.store.PushSubscriptions.Upsert(r.Context(), sub); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// unsubscribePushHandler removes a push subscription owned by the current user.
//
//	@Summary		Unsubscribe from push notifications
//	@Description	Removes the given Web Push subscription for the authenticated user
//	@Tags			hackers
//	@Accept			json
//	@Param			subscription	body	UnsubscribePushPayload	true	"Subscription to remove"
//	@Success		204
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/notifications/subscribe [delete]
func (app *application) unsubscribePushHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var payload UnsubscribePushPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.PushSubscriptions.DeleteByEndpoint(r.Context(), user.ID, payload.Endpoint); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("subscription not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
