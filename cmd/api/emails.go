package main

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/store"
)

// decisionEmailConcurrency bounds how many emails are in flight at once. Both
// mailer backends open a fresh connection per message, so an unbounded fan-out
// over hundreds of applicants would exhaust connections.
const decisionEmailConcurrency = 10

// decisionEmailMarkTimeout bounds the per-recipient sent-marker write that
// follows each successful send.
const decisionEmailMarkTimeout = 10 * time.Second

// decisionPushTimeout bounds the push fan-out that follows a decision email run.
const decisionPushTimeout = 90 * time.Second

// decisionPushTTL is how long push services hold the alert for a device that
// is offline. Decisions stay relevant for days, unlike schedule reminders.
const decisionPushTTL = 24 * time.Hour

const (
	decisionEmailModeDecision     = "decision"
	decisionEmailModeAnnouncement = "announcement"
)

type SendDecisionEmailsPayload struct {
	Mode      string                    `json:"mode" validate:"required,oneof=decision announcement"`
	Statuses  []store.ApplicationStatus `json:"statuses" validate:"omitempty,dive,oneof=accepted waitlisted rejected"`
	ResendAll bool                      `json:"resend_all"`
	// SendPush also sends a Web Push alert to every recipient who has enabled
	// notifications. The alert never includes the outcome.
	SendPush bool `json:"send_push"`
}

type SendDecisionEmailsResponse struct {
	Mode    string `json:"mode"`
	Queued  int    `json:"queued"`
	Skipped int    `json:"skipped"`
	// PushRecipients is how many of the queued applicants will also get a push
	// alert. Zero when send_push is off or no recipient has a subscription.
	PushRecipients int `json:"push_recipients"`
}

type DecisionEmailStatsResponse struct {
	Stats *store.DecisionEmailStats `json:"stats"`
}

// sendDecisionEmailsHandler emails applicants their released decision, or a
// neutral "decisions are out" announcement.
//
//	@Summary		Send decision emails (Super Admin)
//	@Description	Emails applicants whose released decision is in the selected statuses; a decision not yet released is never emailed. Mode "decision" sends the per-status accept/waitlist/reject email; mode "announcement" sends a neutral decisions-are-out email to every applicant with a released decision without revealing the outcome. Recipients already emailed for that mode are skipped unless resend_all is set. With send_push, recipients who enabled push notifications also get a neutral "decisions are out" push after the emails go out. Sending happens in the background and each recipient is marked as emailed only after their message is accepted by the mail provider; the response reports how many were queued and how many will also be pushed. Returns 409 while a previous run is still sending.
//	@Tags			superadmin/emails
//	@Accept			json
//	@Produce		json
//	@Param			body	body		SendDecisionEmailsPayload	true	"Send options"
//	@Success		200		{object}	SendDecisionEmailsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}
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

	if payload.Mode == decisionEmailModeDecision && len(payload.Statuses) == 0 {
		app.badRequestResponse(w, r, errors.New("at least one status is required in decision mode"))
		return
	}

	response, err := app.queueDecisionEmails(r, decisionEmailRun{
		mode:      payload.Mode,
		statuses:  payload.Statuses,
		resendAll: payload.ResendAll,
		sendPush:  payload.SendPush,
	})
	if err != nil {
		if errors.Is(err, errDecisionEmailsInFlight) {
			app.conflictResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

var errDecisionEmailsInFlight = errors.New("decision emails are already being sent")

// decisionEmailRun selects who a decision email run reaches.
type decisionEmailRun struct {
	mode string
	// statuses are the released decisions to email in decision mode; the
	// announcement always goes to every released decision.
	statuses  []store.ApplicationStatus
	resendAll bool
	// releaseID narrows the run to the applicants one release published.
	releaseID string
	sendPush  bool
}

// queueDecisionEmails starts a decision email run in the background and
// reports how many recipients it queued. Only released decisions are emailed,
// so a message never describes something the portal does not show yet.
// Returns errDecisionEmailsInFlight while another run is still sending.
func (app *application) queueDecisionEmails(r *http.Request, run decisionEmailRun) (*SendDecisionEmailsResponse, error) {
	// The announcement reveals nothing, so it always goes to every decided
	// applicant in scope — a per-status audience would leak the outcome by
	// omission.
	kind, statuses := store.DecisionEmailKindDecision, run.statuses
	if run.mode == decisionEmailModeAnnouncement {
		kind, statuses = store.DecisionEmailKindAnnouncement, store.DecisionEmailStatuses
	}

	// The send runs in the background and can take minutes. Recipients are
	// marked as emailed one by one, after each successful send, so a process
	// exit mid-run leaves the unsent remainder unmarked and retryable. That
	// means the marker cannot double as the double-click guard; a single
	// in-flight run per process fills that role instead. It is taken before
	// the recipient query so a second request cannot snapshot recipients the
	// current run is still working through.
	if !app.decisionEmailInFlight.CompareAndSwap(false, true) {
		return nil, errDecisionEmailsInFlight
	}
	handedOff := false
	defer func() {
		if !handedOff {
			app.decisionEmailInFlight.Store(false)
		}
	}()

	recipients, err := app.store.Application.GetDecisionEmailRecipients(r.Context(), statuses, kind, !run.resendAll, run.releaseID)
	if err != nil {
		return nil, err
	}

	skipped := 0
	if !run.resendAll {
		all, err := app.store.Application.GetDecisionEmailRecipients(r.Context(), statuses, kind, false, run.releaseID)
		if err != nil {
			return nil, err
		}
		skipped = len(all) - len(recipients)
	}

	if len(recipients) == 0 {
		return &SendDecisionEmailsResponse{Mode: run.mode, Skipped: skipped}, nil
	}

	// Subscriptions are resolved before the hand-off so the response can say how
	// many applicants will also hear about this on their phone or desktop.
	var pushSubs []store.PushSubscription
	if run.sendPush && app.pushConfigured() {
		userIDs := make([]string, len(recipients))
		for i, recipient := range recipients {
			userIDs[i] = recipient.UserID
		}
		pushSubs, err = app.store.PushSubscriptions.ListByUserIDs(r.Context(), userIDs)
		if err != nil {
			return nil, err
		}
	}
	pushRecipients := countDistinctUsers(pushSubs)

	logFields := []any{
		"mode", run.mode,
		"queued", len(recipients),
		"skipped", skipped,
		"push_recipients", pushRecipients,
		"release_id", run.releaseID,
	}
	if admin := getUserFromContext(r.Context()); admin != nil {
		logFields = append(logFields, "admin_id", admin.ID)
	}
	app.requestLogger(r).Infow("dispatching decision emails", logFields...)

	handedOff = true
	app.backgroundJobs.Add(1)
	go func() {
		defer app.backgroundJobs.Done()
		defer app.decisionEmailInFlight.Store(false)
		app.dispatchDecisionEmails(recipients, kind)
		// Pushed after the emails so the message is already in the inbox when
		// the alert sends someone to look for it.
		app.dispatchDecisionPush(pushSubs, kind)
	}()

	return &SendDecisionEmailsResponse{
		Mode:           run.mode,
		Queued:         len(recipients),
		Skipped:        skipped,
		PushRecipients: pushRecipients,
	}, nil
}

// dispatchDecisionEmails sends to every recipient with bounded concurrency,
// stamping each recipient's sent marker only once their message has been
// accepted. Failed sends stay unmarked so a later run retries only them. It
// runs outside the request, so it must not use the request context.
func (app *application) dispatchDecisionEmails(recipients []store.DecisionEmailRecipient, kind store.DecisionEmailKind) {
	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		failed    int
		unmarked  int
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
				failed++
				mu.Unlock()
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), decisionEmailMarkTimeout)
			defer cancel()
			if err := app.store.Application.SetDecisionEmailSent(ctx, []string{recipient.ApplicationID}, kind, true); err != nil {
				app.logger.Errorw("failed to mark decision email as sent",
					"error", err,
					"kind", kind,
					"user_id", recipient.UserID,
					"application_id", recipient.ApplicationID,
				)
				mu.Lock()
				unmarked++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	app.logger.Infow("finished dispatching decision emails",
		"kind", kind,
		"sent", len(recipients)-failed,
		"failed", failed,
		"sent_but_unmarked", unmarked,
	)
}

func countDistinctUsers(subs []store.PushSubscription) int {
	seen := make(map[string]struct{}, len(subs))
	for _, sub := range subs {
		seen[sub.UserID] = struct{}{}
	}
	return len(seen)
}

// decisionPushPayload is the alert every decision recipient gets, whichever
// email kind triggered it. It deliberately says nothing about the outcome: a
// lock screen is not where someone should learn they were rejected, and the
// email that just went out has the details.
func decisionPushPayload(kind store.DecisionEmailKind) pushPayload {
	url := "/app"
	return pushPayload{
		ID:    "decision-" + string(kind),
		Title: "Decisions are out",
		Body:  "Your application decision is ready. Open the portal to see it.",
		URL:   &url,
	}
}

// dispatchDecisionPush sends the neutral decisions-are-out alert to the given
// subscriptions. Like the emails it runs outside the request; unlike them it
// is best effort, since the email is the record of delivery.
func (app *application) dispatchDecisionPush(subs []store.PushSubscription, kind store.DecisionEmailKind) {
	if len(subs) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), decisionPushTimeout)
	defer cancel()

	delivered, err := app.sendPushToSubscriptions(ctx, subs, decisionPushPayload(kind), app.webpushOptions(decisionPushTTL))
	if err != nil {
		app.logger.Errorw("decision push failed",
			"error", err,
			"kind", kind,
			"subscriptions", len(subs),
			"delivered", delivered,
		)
		return
	}

	app.logger.Infow("finished dispatching decision push",
		"kind", kind,
		"subscriptions", len(subs),
		"delivered", delivered,
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
