package main

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
)

// Decision release emails: none, or one of the decision email modes.
const decisionReleaseEmailNone = "none"

type CreateDecisionReleasePayload struct {
	Audience store.DecisionReleaseAudience `json:"audience" validate:"required,oneof=priority non_priority everyone"`
	Statuses []store.ApplicationStatus     `json:"statuses" validate:"required,min=1,dive,oneof=accepted waitlisted rejected"`
	// Email sends the release's applicants an email once it is saved: none, a
	// neutral "announcement", or each applicant's "decision".
	Email string `json:"email" validate:"omitempty,oneof=none announcement decision"`
	// SendPush also sends the neutral push alert to emailed applicants.
	SendPush bool `json:"send_push"`
}

type CreateDecisionReleaseResponse struct {
	Release *store.DecisionRelease `json:"release"`
	// Emails reports the email run started for the release, when one was asked for.
	Emails *SendDecisionEmailsResponse `json:"emails,omitempty"`
	// EmailError explains why requested emails were not started. The release
	// itself still went out; send them from the Send Emails dialog.
	EmailError string `json:"email_error,omitempty"`
}

type DecisionReleasePreviewResponse struct {
	Audience         store.DecisionReleaseAudience `json:"audience"`
	PriorityDeadline *time.Time                    `json:"priority_deadline"`
	Preview          *store.DecisionReleasePreview `json:"preview"`
}

type DecisionReleasesResponse struct {
	Releases []store.DecisionRelease `json:"releases"`
}

var errPriorityDeadlineUnset = errors.New("set a priority deadline in Settings before releasing by priority")

// decisionReleaseFilter resolves an audience against the current priority
// deadline, which the priority audiences need and everyone does not.
func (app *application) decisionReleaseFilter(ctx context.Context, audience store.DecisionReleaseAudience, statuses []store.ApplicationStatus) (store.DecisionReleaseFilter, error) {
	filter := store.DecisionReleaseFilter{Audience: audience, Statuses: statuses}
	if audience == store.AudienceEveryone {
		return filter, nil
	}

	deadline, err := app.store.Settings.GetPriorityDeadline(ctx)
	if err != nil {
		return filter, err
	}
	if deadline == nil {
		return filter, errPriorityDeadlineUnset
	}
	filter.PriorityDeadline = deadline
	return filter, nil
}

// listDecisionReleasesHandler lists every decision release
//
//	@Summary		List decision releases (Super Admin)
//	@Description	Returns every decision release, newest first, with who released it, the audience and statuses it covered, how many applicants it published, how many of them have been emailed since, and whether it was undone.
//	@Tags			superadmin/decisions
//	@Produce		json
//	@Success		200	{object}	DecisionReleasesResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/decisions/releases [get]
func (app *application) listDecisionReleasesHandler(w http.ResponseWriter, r *http.Request) {
	releases, err := app.store.DecisionReleases.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DecisionReleasesResponse{Releases: releases}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// previewDecisionReleaseHandler counts what a release to an audience would do
//
//	@Summary		Preview a decision release (Super Admin)
//	@Description	For every decided status in the audience, counts the applicants a release would publish for the first time, whose released decision would change (and of those, who already RSVP'd), whose travel decision alone would change, and who already see their current decision; plus how many are still under review and would be left out. priority and non_priority need a priority deadline.
//	@Tags			superadmin/decisions
//	@Produce		json
//	@Param			audience	query		string	true	"priority, non_priority, or everyone"
//	@Success		200			{object}	DecisionReleasePreviewResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/decisions/releases/preview [get]
func (app *application) previewDecisionReleaseHandler(w http.ResponseWriter, r *http.Request) {
	audience := store.DecisionReleaseAudience(r.URL.Query().Get("audience"))
	switch audience {
	case store.AudiencePriority, store.AudienceNonPriority, store.AudienceEveryone:
	default:
		app.badRequestResponse(w, r, errors.New("audience must be priority, non_priority, or everyone"))
		return
	}

	filter, err := app.decisionReleaseFilter(r.Context(), audience, nil)
	if err != nil {
		if errors.Is(err, errPriorityDeadlineUnset) {
			app.badRequestResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	preview, err := app.store.DecisionReleases.Preview(r.Context(), filter)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DecisionReleasePreviewResponse{
		Audience:         audience,
		PriorityDeadline: filter.PriorityDeadline,
		Preview:          preview,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// createDecisionReleaseHandler releases the current decisions of a group of applicants
//
//	@Summary		Release decisions (Super Admin)
//	@Description	Publishes the current decision of every applicant in the audience whose status is one of statuses and whose hacker does not see it yet, including decisions changed since an earlier release. Hackers see only released decisions, so anything changed afterwards stays hidden until the next release. A changed decision has its email markers cleared so it is emailed again. With email set, the release's applicants are then emailed (and pushed, with send_push); if that cannot start, the release still stands and email_error says why. Returns 409 when nothing would change, or when emails were asked for while a previous email run is still sending (nothing is released then).
//	@Tags			superadmin/decisions
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		CreateDecisionReleasePayload	true	"Audience, statuses, and emails"
//	@Success		201		{object}	CreateDecisionReleaseResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/decisions/releases [post]
func (app *application) createDecisionReleaseHandler(w http.ResponseWriter, r *http.Request) {
	var payload CreateDecisionReleasePayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	admin := getUserFromContext(r.Context())
	if admin == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	sendEmails := payload.Email != "" && payload.Email != decisionReleaseEmailNone
	// Checked up front so a release that asked for emails does not go out
	// without them; a run starting in the instant before the send below is
	// reported through email_error instead.
	if sendEmails && app.decisionEmailInFlight.Load() {
		app.conflictResponse(w, r, errors.New("decision emails are still sending; release once they finish"))
		return
	}

	filter, err := app.decisionReleaseFilter(r.Context(), payload.Audience, payload.Statuses)
	if err != nil {
		if errors.Is(err, errPriorityDeadlineUnset) {
			app.badRequestResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	release, err := app.store.DecisionReleases.Create(r.Context(), filter, admin.ID)
	if err != nil {
		if errors.Is(err, store.ErrNothingToRelease) {
			app.conflictResponse(w, r, errors.New("no unreleased decisions match this audience and these statuses"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	release.ReleasedByEmail = &admin.Email

	app.requestLogger(r).Infow("released decisions",
		"release_id", release.ID,
		"audience", release.Audience,
		"statuses", release.Statuses,
		"released", release.ReleasedCount,
		"admin_id", admin.ID,
	)

	response := CreateDecisionReleaseResponse{Release: release}
	if sendEmails {
		emails, err := app.queueDecisionEmails(r, decisionEmailRun{
			mode:      payload.Email,
			statuses:  payload.Statuses,
			releaseID: release.ID,
			sendPush:  payload.SendPush,
		})
		if err != nil {
			app.requestLogger(r).Errorw("decision release emails not started", "release_id", release.ID, "error", err)
			response.EmailError = "Decisions were released, but the emails did not start: " + err.Error() + ". Send them from Send Emails."
		} else {
			response.Emails = emails
		}
	}

	if err := app.jsonResponse(w, http.StatusCreated, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// undoDecisionReleaseHandler undoes the most recent decision release
//
//	@Summary		Undo a decision release (Super Admin)
//	@Description	Reverts the most recent release still in effect: each applicant it published goes back to what they could see before (under review, or their earlier released decision), and their email markers are restored. Current decisions are untouched, and emails already sent cannot be recalled. Applicants reopened to draft since are left alone. Returns the updated release list. 409 for any release but the most recent one in effect.
//	@Tags			superadmin/decisions
//	@Produce		json
//	@Param			releaseID	path		string	true	"Release ID"
//	@Success		200			{object}	DecisionReleasesResponse
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		404			{object}	object{error=string}
//	@Failure		409			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/decisions/releases/{releaseID}/undo [post]
func (app *application) undoDecisionReleaseHandler(w http.ResponseWriter, r *http.Request) {
	releaseID := chi.URLParam(r, "releaseID")
	if releaseID == "" {
		app.badRequestResponse(w, r, errors.New("release ID is required"))
		return
	}

	admin := getUserFromContext(r.Context())
	if admin == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	if err := app.store.DecisionReleases.Undo(r.Context(), releaseID, admin.ID); err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			app.notFoundResponse(w, r, errors.New("release not found"))
		case errors.Is(err, store.ErrNotLatestRelease):
			app.conflictResponse(w, r, errors.New("only the most recent release can be undone"))
		default:
			app.internalServerError(w, r, err)
		}
		return
	}

	app.requestLogger(r).Infow("undid decision release", "release_id", releaseID, "admin_id", admin.ID)

	releases, err := app.store.DecisionReleases.List(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DecisionReleasesResponse{Releases: releases}); err != nil {
		app.internalServerError(w, r, err)
	}
}
