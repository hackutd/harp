package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
)

const (
	referralCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	referralCodeLength   = 8
	// Generated codes are random enough that a collision is rare; a few
	// retries turn "rare" into "never" without looping forever on a bad DB.
	referralCodeAttempts = 3
)

// referralCodePattern bounds what can sit in ?s=. It keeps links URL-safe
// without escaping and keeps the header the portal forwards it in clean.
var referralCodePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,64}$`)

type CreateReferralPayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
	// Code is optional; leave it empty to generate a random one. A readable
	// code tells applicants which sponsor sent them, so random is the default.
	Code string `json:"code"`
}

type UpdateReferralPayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
	Code string `json:"code" validate:"required"`
}

type ReferralListResponse struct {
	Referrals []store.Referral `json:"referrals"`
}

type ReferralSignupsResponse struct {
	Signups []store.ReferralSignup `json:"signups"`
}

func validReferralCode(code string) error {
	if !referralCodePattern.MatchString(code) {
		return errors.New("code must be 3-64 letters, digits, '-' or '_'")
	}
	return nil
}

func generateReferralCode() (string, error) {
	alphabetLen := big.NewInt(int64(len(referralCodeAlphabet)))
	b := make([]byte, referralCodeLength)
	for i := range b {
		n, err := rand.Int(rand.Reader, alphabetLen)
		if err != nil {
			return "", err
		}
		b[i] = referralCodeAlphabet[n.Int64()]
	}
	return string(b), nil
}

// listReferralsHandler returns all referral links with their counts
//
//	@Summary		List referrals (Super Admin)
//	@Description	Returns all referral links, newest first, with visit and signup counts
//	@Tags			superadmin/referrals
//	@Produce		json
//	@Success		200	{object}	ReferralListResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/referrals [get]
func (app *application) listReferralsHandler(w http.ResponseWriter, r *http.Request) {
	referrals, err := app.store.Referrals.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ReferralListResponse{Referrals: referrals}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createReferralHandler creates a referral link
//
//	@Summary		Create referral (Super Admin)
//	@Description	Creates a referral link. Omit code to generate a random one.
//	@Tags			superadmin/referrals
//	@Accept			json
//	@Produce		json
//	@Param			referral	body		CreateReferralPayload	true	"Referral to create"
//	@Success		201			{object}	store.Referral
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/referrals [post]
func (app *application) createReferralHandler(w http.ResponseWriter, r *http.Request) {
	var payload CreateReferralPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	payload.Name = strings.TrimSpace(payload.Name)
	payload.Code = strings.TrimSpace(payload.Code)
	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if payload.Code != "" {
		if err := validReferralCode(payload.Code); err != nil {
			app.badRequestResponse(w, r, err)
			return
		}
		referral := &store.Referral{Name: payload.Name, Code: payload.Code}
		if err := app.store.Referrals.Create(r.Context(), referral); err != nil {
			if errors.Is(err, store.ErrConflict) {
				app.conflictResponse(w, r, fmt.Errorf("code %q is already in use", payload.Code))
				return
			}
			app.internalServerError(w, r, err)
			return
		}
		if err := app.jsonResponse(w, http.StatusCreated, referral); err != nil {
			app.internalServerError(w, r, err)
		}
		return
	}

	for range referralCodeAttempts {
		code, err := generateReferralCode()
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		referral := &store.Referral{Name: payload.Name, Code: code}
		err = app.store.Referrals.Create(r.Context(), referral)
		if errors.Is(err, store.ErrConflict) {
			continue
		}
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		if err := app.jsonResponse(w, http.StatusCreated, referral); err != nil {
			app.internalServerError(w, r, err)
		}
		return
	}

	app.internalServerError(w, r, errors.New("could not generate a unique referral code"))
}

// updateReferralHandler renames a referral or changes its code
//
//	@Summary		Update referral (Super Admin)
//	@Description	Updates a referral's name and code. Changing the code breaks links already shared.
//	@Tags			superadmin/referrals
//	@Accept			json
//	@Produce		json
//	@Param			referralID	path		string					true	"Referral ID"
//	@Param			referral	body		UpdateReferralPayload	true	"Referral updates"
//	@Success		200			{object}	store.Referral
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/referrals/{referralID} [put]
func (app *application) updateReferralHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "referralID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing referral ID"))
		return
	}

	var payload UpdateReferralPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	payload.Name = strings.TrimSpace(payload.Name)
	payload.Code = strings.TrimSpace(payload.Code)
	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := validReferralCode(payload.Code); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	referral := &store.Referral{ID: id, Name: payload.Name, Code: payload.Code}
	if err := app.store.Referrals.Update(r.Context(), referral); err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, err)
		case errors.Is(err, store.ErrConflict):
			app.conflictResponse(w, r, fmt.Errorf("code %q is already in use", payload.Code))
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, referral); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteReferralHandler deletes a referral link
//
//	@Summary		Delete referral (Super Admin)
//	@Description	Deletes a referral link. Users who signed up through it keep their accounts but lose the attribution.
//	@Tags			superadmin/referrals
//	@Param			referralID	path	string	true	"Referral ID"
//	@Success		204
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/referrals/{referralID} [delete]
func (app *application) deleteReferralHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "referralID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing referral ID"))
		return
	}

	if err := app.store.Referrals.Delete(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// listReferralSignupsHandler lists the users who signed up through a referral
//
//	@Summary		List referral signups (Super Admin)
//	@Description	Returns the users whose account was created through this referral link, newest first
//	@Tags			superadmin/referrals
//	@Produce		json
//	@Param			referralID	path		string	true	"Referral ID"
//	@Success		200			{object}	ReferralSignupsResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/referrals/{referralID}/signups [get]
func (app *application) listReferralSignupsHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "referralID")
	if id == "" {
		app.badRequestResponse(w, r, errors.New("missing referral ID"))
		return
	}

	signups, err := app.store.Referrals.ListSignups(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, ReferralSignupsResponse{Signups: signups}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// recordReferralVisitHandler counts a landing on a referral link
//
//	@Summary		Record referral visit
//	@Description	Counts one visit to /?s={code}. Unauthenticated; always 204 so codes can't be probed.
//	@Tags			public
//	@Param			code	path	string	true	"Referral code"
//	@Success		204
//	@Failure		500	{object}	object{error=string}
//	@Router			/referrals/{code}/visit [post]
func (app *application) recordReferralVisitHandler(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if validReferralCode(code) == nil {
		if err := app.store.Referrals.RecordVisit(r.Context(), code); err != nil {
			app.internalServerError(w, r, err)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
