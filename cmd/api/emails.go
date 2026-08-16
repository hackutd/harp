package main

import (
	"context"
	"errors"
	"net/http"
	"sync"

	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/store"
)

// decisionEmailConcurrency bounds how many emails are in flight at once. Both
// mailer backends open a fresh connection per message, so an unbounded fan-out
// over hundreds of applicants would exhaust connections.
const decisionEmailConcurrency = 10

const (
	decisionEmailModeDecision     = "decision"
	decisionEmailModeAnnouncement = "announcement"
)

type SendDecisionEmailsPayload struct {
	Mode      string                    `json:"mode" validate:"required,oneof=decision announcement"`
	Statuses  []store.ApplicationStatus `json:"statuses" validate:"omitempty,dive,oneof=accepted waitlisted rejected"`
	ResendAll bool                      `json:"resend_all"`
}

type SendDecisionEmailsResponse struct {
	Mode    string `json:"mode"`
	Queued  int    `json:"queued"`
	Skipped int    `json:"skipped"`
}

type DecisionEmailStatsResponse struct {
	Stats *store.DecisionEmailStats `json:"stats"`
}

// sendDecisionEmailsHandler emails applicants their decision, or a neutral
// "decisions are out" announcement.
//
//	@Summary		Send decision emails (Super Admin)
//	@Description	Emails applicants in the selected statuses. Mode "decision" sends the per-status accept/waitlist/reject email; mode "announcement" sends a neutral decisions-are-out email to every decided applicant without revealing the outcome. Recipients already emailed for that mode are skipped unless resend_all is set. Sending happens in the background; the response reports how many were queued.
//	@Tags			superadmin/emails
//	@Accept			json
//	@Produce		json
//	@Param			body	body		SendDecisionEmailsPayload	true	"Send options"
//	@Success		200		{object}	SendDecisionEmailsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/emails/decisions [post]
func (app *application) sendDecisionEmailsHandler(w http.ResponseWriter, r *http.Request) {
	var payload SendDecisionEmailsPayload
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

	// The announcement reveals nothing, so it always goes to every decided
	// applicant — a per-status audience would leak the outcome by omission.
	var (
		kind     store.DecisionEmailKind
		statuses []store.ApplicationStatus
	)
	switch payload.Mode {
	case decisionEmailModeAnnouncement:
		kind = store.DecisionEmailKindAnnouncement
		statuses = store.DecisionEmailStatuses
	default:
		if len(payload.Statuses) == 0 {
			app.badRequestResponse(w, r, errors.New("at least one status is required in decision mode"))
			return
		}
		kind = store.DecisionEmailKindDecision
		statuses = payload.Statuses
	}

	recipients, err := app.store.Application.GetDecisionEmailRecipients(r.Context(), statuses, kind, !payload.ResendAll)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	skipped := 0
	if !payload.ResendAll {
		all, err := app.store.Application.GetDecisionEmailRecipients(r.Context(), statuses, kind, false)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		skipped = len(all) - len(recipients)
	}

	if len(recipients) == 0 {
		if err := app.jsonResponse(w, http.StatusOK, SendDecisionEmailsResponse{
			Mode:    payload.Mode,
			Queued:  0,
			Skipped: skipped,
		}); err != nil {
			app.internalServerError(w, r, err)
		}
		return
	}

	// Mark before sending. The send runs in the background and can take
	// minutes, so this is what stops a double-click or a concurrent request
	// from blasting everyone twice. Failed sends are un-marked afterwards so a
	// later run retries only them.
	applicationIDs := make([]string, len(recipients))
	for i, recipient := range recipients {
		applicationIDs[i] = recipient.ApplicationID
	}

	if err := app.store.Application.SetDecisionEmailSent(r.Context(), applicationIDs, kind, true); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.logger.Infow("dispatching decision emails",
		"mode", payload.Mode,
		"queued", len(recipients),
		"skipped", skipped,
		"admin_id", admin.ID,
	)

	go app.dispatchDecisionEmails(recipients, kind)

	if err := app.jsonResponse(w, http.StatusOK, SendDecisionEmailsResponse{
		Mode:    payload.Mode,
		Queued:  len(recipients),
		Skipped: skipped,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// dispatchDecisionEmails sends to every recipient with bounded concurrency and
// hands failures back by clearing their sent marker. It runs outside the
// request, so it must not use the request context.
func (app *application) dispatchDecisionEmails(recipients []store.DecisionEmailRecipient, kind store.DecisionEmailKind) {
	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		failedIDs []string
		semaphore = make(chan struct{}, decisionEmailConcurrency)
	)

	for _, recipient := range recipients {
		wg.Add(1)
		go func() {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			name := "Hacker"
			if recipient.FirstName != nil && *recipient.FirstName != "" {
				name = *recipient.FirstName
			}

			var err error
			if kind == store.DecisionEmailKindAnnouncement {
				err = app.mailer.SendDecisionsReleasedEmail(recipient.Email, name)
			} else {
				err = app.mailer.SendDecisionEmail(recipient.Email, name, mailer.Decision(recipient.Status))
			}
			if err != nil {
				app.logger.Errorw("failed to send decision email",
					"error", err,
					"kind", kind,
					"user_id", recipient.UserID,
				)
				mu.Lock()
				failedIDs = append(failedIDs, recipient.ApplicationID)
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	if len(failedIDs) > 0 {
		if err := app.store.Application.SetDecisionEmailSent(context.Background(), failedIDs, kind, false); err != nil {
			app.logger.Errorw("failed to clear sent marker for failed decision emails",
				"error", err,
				"kind", kind,
				"count", len(failedIDs),
			)
		}
	}

	app.logger.Infow("finished dispatching decision emails",
		"kind", kind,
		"sent", len(recipients)-len(failedIDs),
		"failed", len(failedIDs),
	)
}

// getDecisionEmailStatsHandler returns per-status sent/pending email counts
//
//	@Summary		Get decision email stats (Super Admin)
//	@Description	Returns how many applicants in each decided status have already been emailed and how many are still pending, for both the decision and announcement emails
//	@Tags			superadmin/emails
//	@Produce		json
//	@Success		200	{object}	DecisionEmailStatsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/emails/decisions/stats [get]
func (app *application) getDecisionEmailStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := app.store.Application.GetDecisionEmailStats(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DecisionEmailStatsResponse{Stats: stats}); err != nil {
		app.internalServerError(w, r, err)
	}
}
