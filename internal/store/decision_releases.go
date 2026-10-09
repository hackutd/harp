package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// A decision release (a "wave") publishes the current decisions of one group
// of applicants. Hackers only ever see the decision a release copied onto
// their application (released_status and friends), so a decision changed
// afterwards stays hidden until a later release covers it. Each release
// records what every applicant it touched could see before, so the most
// recent one can be undone.

// DecisionReleaseAudience selects applicants by when they submitted relative
// to the priority deadline.
type DecisionReleaseAudience string

const (
	AudiencePriority    DecisionReleaseAudience = "priority"
	AudienceNonPriority DecisionReleaseAudience = "non_priority"
	AudienceEveryone    DecisionReleaseAudience = "everyone"
)

var (
	// ErrNothingToRelease is returned when no applicant in the selection has a
	// decision that differs from what they can already see.
	ErrNothingToRelease = fmt.Errorf("%w: no unreleased decisions match", ErrConflict)
	// ErrNotLatestRelease is returned when undoing a release other than the
	// most recent one still in effect.
	ErrNotLatestRelease = fmt.Errorf("%w: only the most recent release can be undone", ErrConflict)
	// ErrPriorityDeadlineRequired is returned when a priority or non-priority
	// audience is used without a deadline to resolve it against.
	ErrPriorityDeadlineRequired = errors.New("a priority deadline is required for this audience")
)

// DecisionReleaseFilter selects the applications a release covers: those in
// one of Statuses within Audience. PriorityDeadline resolves the audience.
type DecisionReleaseFilter struct {
	Audience         DecisionReleaseAudience
	Statuses         []ApplicationStatus
	PriorityDeadline *time.Time
}

type DecisionRelease struct {
	ID               string                  `json:"id"`
	ReleasedBy       *string                 `json:"released_by"`
	ReleasedByEmail  *string                 `json:"released_by_email"`
	Audience         DecisionReleaseAudience `json:"audience"`
	Statuses         []ApplicationStatus     `json:"statuses"`
	PriorityDeadline *time.Time              `json:"priority_deadline"`
	ReleasedCount    int                     `json:"released_count"`
	CreatedAt        time.Time               `json:"created_at"`
	UndoneAt         *time.Time              `json:"undone_at"`
	UndoneByEmail    *string                 `json:"undone_by_email"`
	// EmailedCount is how many of the release's applicants have been emailed
	// (decision or announcement) since it went out. Undo cannot recall those.
	EmailedCount int `json:"emailed_count"`
}

// DecisionReleaseCounts breaks down the applicants in one status.
type DecisionReleaseCounts struct {
	// New have never had a decision released.
	New int `json:"new"`
	// Changed had a different decision released.
	Changed int `json:"changed"`
	// TravelOnly have this decision released already, but their travel
	// decision has changed since.
	TravelOnly int `json:"travel_only"`
	// Unchanged already see exactly this decision.
	Unchanged int `json:"unchanged"`
	// RSVPChanged are the Changed applicants who have already RSVP'd to the
	// decision they can see.
	RSVPChanged int `json:"rsvp_changed"`
}

// Releasable is how many applicants a release of this status would update.
func (c DecisionReleaseCounts) Releasable() int {
	return c.New + c.Changed + c.TravelOnly
}

// DecisionReleasePreview describes what a release would do, per decided
// status, across the audience regardless of which statuses are selected.
type DecisionReleasePreview struct {
	ByStatus map[ApplicationStatus]DecisionReleaseCounts `json:"by_status"`
	// UnderReview is how many applicants in the audience have no decision yet
	// and so are left out of any release.
	UnderReview int `json:"under_review"`
}

type DecisionReleasesStore struct {
	db *sql.DB
}

// decisionReleaseLockKey serializes releases and undos, so an undo always
// sees the release it is undoing as the latest and two releases never
// interleave their writes to the same applications.
const decisionReleaseLockKey = 0x68617270_72656c // "harp rel"

// The travel decision a release publishes: only a decided one, with the amount
// only when approved. Undecided travel shows as pending to the hacker.
const (
	releasableTravelStatusSQL = `CASE WHEN a.travel_status IN ('approved', 'rejected') THEN a.travel_status END`
	releasableTravelAmountSQL = `CASE WHEN a.travel_status = 'approved' THEN a.travel_approved_amount_cents END`
	travelChangedSQL          = `(a.released_travel_status IS DISTINCT FROM (` + releasableTravelStatusSQL + `)
		OR a.released_travel_amount_cents IS DISTINCT FROM (` + releasableTravelAmountSQL + `))`
	// releasePendingSQL matches an application whose current decision differs
	// from the one its hacker can see.
	releasePendingSQL = `(a.released_status IS DISTINCT FROM a.status OR ` + travelChangedSQL + `)`
)

// audienceCondition returns the SQL predicate for an audience, binding the
// deadline through param.
func audienceCondition(filter DecisionReleaseFilter, param func(any) string) (string, error) {
	switch filter.Audience {
	case AudienceEveryone:
		return "TRUE", nil
	case AudiencePriority, AudienceNonPriority:
		if filter.PriorityDeadline == nil {
			return "", ErrPriorityDeadlineRequired
		}
		op := "<="
		if filter.Audience == AudienceNonPriority {
			op = ">"
		}
		return "a.submitted_at " + op + " " + param(*filter.PriorityDeadline) + "::timestamptz", nil
	}
	return "", fmt.Errorf("unknown audience %q", filter.Audience)
}

func statusStrings(statuses []ApplicationStatus) []string {
	out := make([]string, len(statuses))
	for i, status := range statuses {
		out[i] = string(status)
	}
	return out
}

// Preview counts what a release to the filter's audience would change, for
// every decided status, so the dialog can update as statuses are toggled.
func (s *DecisionReleasesStore) Preview(ctx context.Context, filter DecisionReleaseFilter) (*DecisionReleasePreview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var args []any
	param := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	audience, err := audienceCondition(filter, param)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT a.status,
		       COUNT(*) FILTER (WHERE a.released_status IS NULL),
		       COUNT(*) FILTER (WHERE a.released_status <> a.status),
		       COUNT(*) FILTER (WHERE a.released_status = a.status AND ` + travelChangedSQL + `),
		       COUNT(*) FILTER (WHERE a.released_status = a.status AND NOT ` + travelChangedSQL + `),
		       COUNT(*) FILTER (WHERE a.released_status <> a.status AND a.rsvp_status <> 'pending')
		FROM applications a
		WHERE a.status IN ('accepted', 'waitlisted', 'rejected', 'submitted')
		  AND ` + audience + `
		GROUP BY a.status`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	preview := &DecisionReleasePreview{ByStatus: make(map[ApplicationStatus]DecisionReleaseCounts)}
	for _, status := range DecisionEmailStatuses {
		preview.ByStatus[status] = DecisionReleaseCounts{}
	}
	for rows.Next() {
		var status ApplicationStatus
		var c DecisionReleaseCounts
		if err := rows.Scan(&status, &c.New, &c.Changed, &c.TravelOnly, &c.Unchanged, &c.RSVPChanged); err != nil {
			return nil, err
		}
		if status == StatusSubmitted {
			preview.UnderReview = c.New + c.Changed + c.TravelOnly + c.Unchanged
			continue
		}
		preview.ByStatus[status] = c
	}

	return preview, rows.Err()
}

// Create releases the current decision of every application matching the
// filter whose hacker cannot see it yet, in one transaction. A changed
// decision has its email markers cleared so the new decision gets its own
// email. Returns ErrNothingToRelease when nothing matched.
func (s *DecisionReleasesStore) Create(ctx context.Context, filter DecisionReleaseFilter, releasedBy string) (*DecisionRelease, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*4)
	defer cancel()

	if len(filter.Statuses) == 0 {
		return nil, errors.New("at least one status is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, decisionReleaseLockKey); err != nil {
		return nil, err
	}

	release := &DecisionRelease{
		Audience:         filter.Audience,
		Statuses:         filter.Statuses,
		PriorityDeadline: filter.PriorityDeadline,
		ReleasedBy:       &releasedBy,
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO decision_releases (released_by, audience, statuses, priority_deadline)
		VALUES ($1, $2, $3::application_status[], $4)
		RETURNING id, created_at`,
		releasedBy, filter.Audience, statusStrings(filter.Statuses), filter.PriorityDeadline,
	).Scan(&release.ID, &release.CreatedAt)
	if err != nil {
		return nil, err
	}

	args := []any{release.ID, statusStrings(filter.Statuses)}
	param := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	audience, err := audienceCondition(filter, param)
	if err != nil {
		return nil, err
	}

	// targets locks the applications and keeps what their hackers could see,
	// which the UPDATE overwrites and the items record for undo. The SET
	// expressions read the pre-update row, so the email markers are cleared
	// only where the decision itself changes.
	query := `
		WITH targets AS (
			SELECT a.id, a.released_status, a.released_travel_status, a.released_travel_amount_cents,
			       a.decision_release_id, a.decision_released_at,
			       a.decision_email_sent_at, a.announcement_email_sent_at
			FROM applications a
			WHERE a.status = ANY($2::application_status[])
			  AND ` + audience + `
			  AND ` + releasePendingSQL + `
			FOR UPDATE
		), released AS (
			UPDATE applications a
			SET released_status = a.status,
			    released_travel_status = ` + releasableTravelStatusSQL + `,
			    released_travel_amount_cents = ` + releasableTravelAmountSQL + `,
			    decision_release_id = $1,
			    decision_released_at = NOW(),
			    decision_email_sent_at = CASE WHEN a.released_status IS DISTINCT FROM a.status
			        THEN NULL ELSE a.decision_email_sent_at END,
			    announcement_email_sent_at = CASE WHEN a.released_status IS DISTINCT FROM a.status
			        THEN NULL ELSE a.announcement_email_sent_at END
			FROM targets t
			WHERE a.id = t.id
			RETURNING a.id, a.released_status, a.released_travel_status, a.released_travel_amount_cents
		)
		INSERT INTO decision_release_items (
			release_id, application_id, status, travel_status, travel_amount_cents,
			previous_status, previous_travel_status, previous_travel_amount_cents,
			previous_release_id, previous_released_at,
			previous_decision_email_sent_at, previous_announcement_email_sent_at
		)
		SELECT $1, r.id, r.released_status, r.released_travel_status, r.released_travel_amount_cents,
		       t.released_status, t.released_travel_status, t.released_travel_amount_cents,
		       t.decision_release_id, t.decision_released_at,
		       t.decision_email_sent_at, t.announcement_email_sent_at
		FROM released r
		JOIN targets t ON t.id = r.id`

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, ErrNothingToRelease
	}
	release.ReleasedCount = int(count)

	if _, err := tx.ExecContext(ctx,
		`UPDATE decision_releases SET released_count = $2 WHERE id = $1`,
		release.ID, release.ReleasedCount,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return release, nil
}

// List returns every release, newest first.
func (s *DecisionReleasesStore) List(ctx context.Context) ([]DecisionRelease, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// Emailed counts the release's applicants who still see its decision and
	// were emailed after it went out.
	query := `
		SELECT r.id, r.released_by, rb.email, r.audience, r.statuses::text[],
		       r.priority_deadline, r.released_count, r.created_at, r.undone_at, ub.email,
		       (SELECT COUNT(*)
		        FROM decision_release_items i
		        JOIN applications a ON a.id = i.application_id
		        WHERE i.release_id = r.id
		          AND a.decision_release_id = r.id
		          AND (a.decision_email_sent_at >= r.created_at
		               OR a.announcement_email_sent_at >= r.created_at))
		FROM decision_releases r
		LEFT JOIN users rb ON rb.id = r.released_by
		LEFT JOIN users ub ON ub.id = r.undone_by
		ORDER BY r.created_at DESC, r.id DESC`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	releases := []DecisionRelease{}
	for rows.Next() {
		var release DecisionRelease
		var statuses StringArray
		if err := rows.Scan(
			&release.ID, &release.ReleasedBy, &release.ReleasedByEmail, &release.Audience, &statuses,
			&release.PriorityDeadline, &release.ReleasedCount, &release.CreatedAt, &release.UndoneAt, &release.UndoneByEmail,
			&release.EmailedCount,
		); err != nil {
			return nil, err
		}
		release.Statuses = make([]ApplicationStatus, len(statuses))
		for i, status := range statuses {
			release.Statuses[i] = ApplicationStatus(status)
		}
		releases = append(releases, release)
	}

	return releases, rows.Err()
}

// Undo reverts the most recent release still in effect: every application it
// changed goes back to what its hacker could see before, including the email
// markers. An application reopened to draft since is left alone. Returns
// ErrNotFound for an unknown release and ErrNotLatestRelease for any other.
func (s *DecisionReleasesStore) Undo(ctx context.Context, id string, undoneBy string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*4)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, decisionReleaseLockKey); err != nil {
		return err
	}

	var latest string
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM decision_releases
		WHERE undone_at IS NULL
		ORDER BY created_at DESC, id DESC
		LIMIT 1`).Scan(&latest)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if latest != id {
		var exists bool
		if err := tx.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM decision_releases WHERE id = $1)`, id,
		).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		return ErrNotLatestRelease
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE applications a
		SET released_status = i.previous_status,
		    released_travel_status = i.previous_travel_status,
		    released_travel_amount_cents = i.previous_travel_amount_cents,
		    decision_release_id = i.previous_release_id,
		    decision_released_at = i.previous_released_at,
		    decision_email_sent_at = i.previous_decision_email_sent_at,
		    announcement_email_sent_at = i.previous_announcement_email_sent_at
		FROM decision_release_items i
		WHERE i.release_id = $1
		  AND a.id = i.application_id
		  AND a.decision_release_id = $1`, id,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE decision_releases SET undone_at = NOW(), undone_by = $2 WHERE id = $1`,
		id, undoneBy,
	); err != nil {
		return err
	}

	return tx.Commit()
}
