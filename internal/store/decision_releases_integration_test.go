package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

// TestIntegrationDecisionReleases walks a decision through release, a change,
// a second release, and an undo, checking what the hacker would see and the
// email markers at each step. Seed: Alice accepted with travel approved and an
// RSVP, Bob submitted, Carol draft.
func TestIntegrationDecisionReleases(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	releases := &DecisionReleasesStore{db: db}
	apps := &ApplicationsStore{db: db}
	ctx := context.Background()

	const (
		admin = "44444444-4444-4444-4444-444444444444"
		alice = "aaaaaaaa-0000-0000-0000-000000000001"
	)
	everyone := func(statuses ...ApplicationStatus) DecisionReleaseFilter {
		return DecisionReleaseFilter{Audience: AudienceEveryone, Statuses: statuses}
	}
	seen := func() *Application {
		t.Helper()
		a, err := apps.GetByID(ctx, alice)
		if err != nil {
			t.Fatal(err)
		}
		return a
	}

	preview, err := releases.Preview(ctx, everyone())
	if err != nil {
		t.Fatal(err)
	}
	if got := preview.ByStatus[StatusAccepted]; got.New != 1 || got.Releasable() != 1 {
		t.Errorf("accepted preview = %+v, want one new", got)
	}
	if preview.UnderReview != 1 {
		t.Errorf("under review = %d, want 1 (Bob)", preview.UnderReview)
	}

	if _, err := releases.Create(ctx, everyone(StatusWaitlisted), admin); !errors.Is(err, ErrNothingToRelease) {
		t.Fatalf("release with no match: err = %v, want ErrNothingToRelease", err)
	}

	first, err := releases.Create(ctx, everyone(StatusAccepted), admin)
	if err != nil {
		t.Fatal(err)
	}
	if first.ReleasedCount != 1 {
		t.Fatalf("first release count = %d, want 1", first.ReleasedCount)
	}
	a := seen()
	if a.ReleasedStatus == nil || *a.ReleasedStatus != StatusAccepted ||
		a.ReleasedTravelStatus == nil || *a.ReleasedTravelStatus != TravelApproved ||
		a.ReleasedTravelAmountCents == nil || *a.ReleasedTravelAmountCents != 20000 {
		t.Fatalf("after first release: %+v %+v %+v", a.ReleasedStatus, a.ReleasedTravelStatus, a.ReleasedTravelAmountCents)
	}

	if _, err := releases.Create(ctx, everyone(StatusAccepted), admin); !errors.Is(err, ErrNothingToRelease) {
		t.Fatalf("re-release of the same decision: err = %v, want ErrNothingToRelease", err)
	}

	// Alice is emailed, then her decision changes: she keeps seeing the
	// acceptance until the change is released.
	if err := apps.SetDecisionEmailSent(ctx, []string{alice}, DecisionEmailKindDecision, true); err != nil {
		t.Fatal(err)
	}
	if _, err := apps.SetStatus(ctx, alice, StatusWaitlisted); err != nil {
		t.Fatal(err)
	}
	if a := seen(); *a.ReleasedStatus != StatusAccepted {
		t.Fatalf("released status after an unreleased change = %s, want accepted", *a.ReleasedStatus)
	}
	preview, err = releases.Preview(ctx, everyone())
	if err != nil {
		t.Fatal(err)
	}
	if got := preview.ByStatus[StatusWaitlisted]; got.Changed != 1 || got.RSVPChanged != 1 {
		t.Errorf("waitlisted preview = %+v, want one changed with an RSVP", got)
	}

	deadline := time.Now().Add(-time.Hour)
	priority := DecisionReleaseFilter{Audience: AudiencePriority, Statuses: []ApplicationStatus{StatusWaitlisted}, PriorityDeadline: &deadline}
	if _, err := releases.Create(ctx, priority, admin); !errors.Is(err, ErrNothingToRelease) {
		t.Fatalf("priority release before Alice submitted: err = %v, want ErrNothingToRelease", err)
	}
	if _, err := releases.Create(ctx, DecisionReleaseFilter{Audience: AudiencePriority, Statuses: priority.Statuses}, admin); !errors.Is(err, ErrPriorityDeadlineRequired) {
		t.Fatalf("priority release without a deadline: err = %v", err)
	}

	nonPriority := priority
	nonPriority.Audience = AudienceNonPriority
	second, err := releases.Create(ctx, nonPriority, admin)
	if err != nil {
		t.Fatal(err)
	}
	var emailedAt *time.Time
	if err := db.QueryRowContext(ctx, `SELECT decision_email_sent_at FROM applications WHERE id = $1`, alice).Scan(&emailedAt); err != nil {
		t.Fatal(err)
	}
	if a := seen(); *a.ReleasedStatus != StatusWaitlisted || emailedAt != nil {
		t.Fatalf("after second release: released %s, emailed %v; want waitlisted and the marker cleared", *a.ReleasedStatus, emailedAt)
	}

	recipients, err := apps.GetDecisionEmailRecipients(ctx, []ApplicationStatus{StatusWaitlisted}, DecisionEmailKindDecision, true, second.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(recipients) != 1 || recipients[0].Status != StatusWaitlisted {
		t.Errorf("second release recipients = %+v, want Alice as waitlisted", recipients)
	}
	if recipients, _ := apps.GetDecisionEmailRecipients(ctx, []ApplicationStatus{StatusWaitlisted}, DecisionEmailKindDecision, true, first.ID); len(recipients) != 0 {
		t.Errorf("first release recipients = %+v, want none (Alice moved on)", recipients)
	}

	list, err := releases.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != second.ID || list[0].ReleasedByEmail == nil {
		t.Fatalf("list = %+v, want the second release first", list)
	}

	if err := releases.Undo(ctx, first.ID, admin); !errors.Is(err, ErrNotLatestRelease) {
		t.Fatalf("undo of an older release: err = %v, want ErrNotLatestRelease", err)
	}
	if err := releases.Undo(ctx, second.ID, admin); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT decision_email_sent_at FROM applications WHERE id = $1`, alice).Scan(&emailedAt); err != nil {
		t.Fatal(err)
	}
	if a := seen(); *a.ReleasedStatus != StatusAccepted || emailedAt == nil {
		t.Fatalf("after undo: released %s, emailed %v; want accepted and the marker restored", *a.ReleasedStatus, emailedAt)
	}

	// The first release is now the latest in effect and can be undone in turn.
	if err := releases.Undo(ctx, first.ID, admin); err != nil {
		t.Fatal(err)
	}
	if a := seen(); a.ReleasedStatus != nil || a.ReleasedTravelStatus != nil {
		t.Fatalf("after undoing both: %+v %+v, want nothing released", a.ReleasedStatus, a.ReleasedTravelStatus)
	}

	// Reopening drops the released decision straight away.
	if _, err := releases.Create(ctx, everyone(StatusWaitlisted), admin); err != nil {
		t.Fatal(err)
	}
	if _, err := apps.SetStatus(ctx, alice, StatusDraft); err != nil {
		t.Fatal(err)
	}
	if a := seen(); a.ReleasedStatus != nil {
		t.Fatalf("after reopen: released %s, want nil", *a.ReleasedStatus)
	}

	// So does moving a released decision back to under review, which no
	// release would ever publish.
	if _, err := apps.SetStatus(ctx, alice, StatusAccepted); err != nil {
		t.Fatal(err)
	}
	if _, err := releases.Create(ctx, everyone(StatusAccepted), admin); err != nil {
		t.Fatal(err)
	}
	if _, err := apps.SetStatus(ctx, alice, StatusSubmitted); err != nil {
		t.Fatal(err)
	}
	if a := seen(); a.ReleasedStatus != nil || a.ReleasedTravelStatus != nil {
		t.Fatalf("after moving back to submitted: released %+v %+v, want nothing released", a.ReleasedStatus, a.ReleasedTravelStatus)
	}
}
