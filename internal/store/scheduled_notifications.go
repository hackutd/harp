package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"
)

// ErrNotificationInFlight is returned when a dispatcher currently holds the
// delivery lease on a notification. It wraps ErrConflict so callers that only
// check for a conflict keep working, while the handler can say why.
var ErrNotificationInFlight = fmt.Errorf("%w: notification is being delivered", ErrConflict)

type ScheduledNotification struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Body           string     `json:"body"`
	URL            *string    `json:"url"`
	TargetRole     *UserRole  `json:"target_role"`
	ScheduledAt    time.Time  `json:"scheduled_at"`
	SentAt         *time.Time `json:"sent_at"`
	RecipientCount int        `json:"recipient_count"`
	ScheduleID     *string    `json:"schedule_id"`
	// ClaimedAt is a revocable delivery lease, not a delivery record: a dispatcher
	// holds it while it fans out pushes, and it is cleared again on every outcome.
	// Only SentAt means hackers were actually notified.
	ClaimedAt *time.Time `json:"claimed_at"`
	Attempts  int        `json:"attempts"`
	// FailedAt is terminal — the dispatcher gave up. LastError says why, and is also
	// set (without FailedAt) on a retryable failure so operators can see what happened.
	FailedAt  *time.Time `json:"failed_at"`
	LastError *string    `json:"last_error"`
	// Nil once the author's account is deleted; the notification outlives them.
	CreatedBy *string   `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ScheduleNotificationGenerationResult summarizes a bulk generation run.
type ScheduleNotificationGenerationResult struct {
	Created int `json:"created"`
	Skipped int `json:"skipped"`
}

type ScheduledNotificationsStore struct {
	db *sql.DB
}

func (s *ScheduledNotificationsStore) Create(ctx context.Context, n *ScheduledNotification) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO scheduled_notifications (title, body, url, target_role, scheduled_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, recipient_count, sent_at, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		n.Title, n.Body, n.URL, n.TargetRole, n.ScheduledAt, n.CreatedBy,
	).Scan(&n.ID, &n.RecipientCount, &n.SentAt, &n.CreatedAt, &n.UpdatedAt)
}

func (s *ScheduledNotificationsStore) GetByID(ctx context.Context, id string) (*ScheduledNotification, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at, claimed_at, attempts, failed_at, last_error
		FROM scheduled_notifications
		WHERE id = $1
	`

	var n ScheduledNotification
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
		&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
		&n.ClaimedAt, &n.Attempts, &n.FailedAt, &n.LastError,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &n, nil
}

func (s *ScheduledNotificationsStore) List(ctx context.Context) ([]ScheduledNotification, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at, claimed_at, attempts, failed_at, last_error
		FROM scheduled_notifications
		ORDER BY scheduled_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notifications := []ScheduledNotification{}
	for rows.Next() {
		var n ScheduledNotification
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
			&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
			&n.ClaimedAt, &n.Attempts, &n.FailedAt, &n.LastError,
		); err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}

	return notifications, rows.Err()
}

func (s *ScheduledNotificationsStore) ListSentForRole(ctx context.Context, role UserRole, limit int) ([]ScheduledNotification, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at, claimed_at, attempts, failed_at, last_error
		FROM scheduled_notifications
		WHERE sent_at IS NOT NULL AND (target_role IS NULL OR target_role = $1)
		ORDER BY sent_at DESC
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, role, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notifications := []ScheduledNotification{}
	for rows.Next() {
		var n ScheduledNotification
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
			&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
			&n.ClaimedAt, &n.Attempts, &n.FailedAt, &n.LastError,
		); err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}

	return notifications, rows.Err()
}

func (s *ScheduledNotificationsStore) Update(ctx context.Context, n *ScheduledNotification) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// Editing clears any failure state, so re-saving a failed notification is the
	// operator's retry button — no separate endpoint needed. A row a dispatcher is
	// delivering right now is refused instead: clearing its lease here would let
	// MarkSent stamp the edited content as sent once the original push lands.
	query := `
		UPDATE scheduled_notifications
		SET title = $1, body = $2, url = $3, target_role = $4, scheduled_at = $5,
		    attempts = 0, failed_at = NULL, claimed_at = NULL, last_error = NULL
		WHERE id = $6 AND sent_at IS NULL AND claimed_at IS NULL
		RETURNING sent_at, recipient_count, schedule_id, created_by, created_at, updated_at,
		          claimed_at, attempts, failed_at, last_error
	`

	err := s.db.QueryRowContext(ctx, query,
		n.Title, n.Body, n.URL, n.TargetRole, n.ScheduledAt, n.ID,
	).Scan(&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
		&n.ClaimedAt, &n.Attempts, &n.FailedAt, &n.LastError)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Could be not found, already sent, or mid-delivery — distinguish
			var sent, claimed bool
			err := s.db.QueryRowContext(ctx,
				`SELECT sent_at IS NOT NULL, claimed_at IS NOT NULL FROM scheduled_notifications WHERE id = $1`, n.ID,
			).Scan(&sent, &claimed)
			switch {
			case errors.Is(err, sql.ErrNoRows):
				return ErrNotFound
			case err != nil:
				return err
			case !sent && claimed:
				return ErrNotificationInFlight
			}
			return ErrConflict
		}
		return err
	}

	return nil
}

func (s *ScheduledNotificationsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	result, err := s.db.ExecContext(ctx, `DELETE FROM scheduled_notifications WHERE id = $1`, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrNotFound
	}

	return nil
}

// ClaimDue leases up to limit due notifications to this dispatcher. The lease is
// claimed_at, NOT sent_at: a process that dies mid-delivery leaves the row claimable
// again once lease elapses, instead of dropping the notification forever. Rows that
// have burned maxAttempts are left for MarkFailed rather than retried indefinitely.
func (s *ScheduledNotificationsStore) ClaimDue(ctx context.Context, now time.Time, lease time.Duration, maxAttempts, limit int) ([]ScheduledNotification, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at, claimed_at, attempts, failed_at, last_error
		FROM scheduled_notifications
		WHERE scheduled_at <= $1
		  AND sent_at IS NULL
		  AND failed_at IS NULL
		  AND attempts < $2
		  AND (claimed_at IS NULL OR claimed_at < $3)
		ORDER BY scheduled_at
		LIMIT $4
		FOR UPDATE SKIP LOCKED
	`, now, maxAttempts, now.Add(-lease), limit)
	if err != nil {
		return nil, err
	}

	var claimed []ScheduledNotification
	var ids []string
	for rows.Next() {
		var n ScheduledNotification
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
			&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
			&n.ClaimedAt, &n.Attempts, &n.FailedAt, &n.LastError,
		); err != nil {
			rows.Close()
			return nil, err
		}
		claimed = append(claimed, n)
		ids = append(ids, n.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return nil, nil
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET claimed_at = $2, attempts = attempts + 1
		WHERE id = ANY($1::uuid[])
	`, ids, now); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Reflect the update we just committed so the caller can tell whether this was
	// the final attempt without re-reading the rows.
	for i := range claimed {
		claimed[i].ClaimedAt = &now
		claimed[i].Attempts++
	}

	return claimed, nil
}

// GenerateFromSchedule (re)builds reminder notifications from the current schedule.
//
// For every schedule item it derives a reminder scheduled `lead` before the event's
// start time. Pending schedule-sourced notifications are cleared first so that repeated
// runs are idempotent and reflect the latest schedule and lead time. Left untouched:
// manually-created ones (schedule_id IS NULL), already-sent and failed ones (both are
// history), and any a dispatcher currently holds a lease on (deleting a row
// mid-delivery would lose the notification). Reminders whose computed send time has
// already passed are skipped.
func (s *ScheduledNotificationsStore) GenerateFromSchedule(ctx context.Context, lead time.Duration, targetRole *UserRole, createdBy string, now time.Time) (*ScheduleNotificationGenerationResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Clear pending schedule-sourced reminders so a re-run reflects the latest schedule.
	// sent_at alone is not enough of a guard any more: a claimed row has sent_at NULL
	// while its pushes are going out, and a failed row is a terminal record the
	// operator needs to see. Both are past due, so the loop below could never
	// recreate them — deleting them would be pure loss.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM scheduled_notifications
		WHERE schedule_id IS NOT NULL
		  AND sent_at IS NULL
		  AND claimed_at IS NULL
		  AND failed_at IS NULL
	`); err != nil {
		return nil, err
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT id, event_name, location, start_time
		FROM schedule
		ORDER BY start_time ASC
	`)
	if err != nil {
		return nil, err
	}

	type scheduleRow struct {
		id        string
		eventName string
		location  string
		startTime time.Time
	}

	var events []scheduleRow
	for rows.Next() {
		var e scheduleRow
		if err := rows.Scan(&e.id, &e.eventName, &e.location, &e.startTime); err != nil {
			rows.Close()
			return nil, err
		}
		events = append(events, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	reminderURL := "/schedule"
	leadMinutes := int(lead.Minutes())

	result := &ScheduleNotificationGenerationResult{}
	for _, e := range events {
		scheduledAt := e.startTime.Add(-lead)
		if !scheduledAt.After(now) {
			result.Skipped++
			continue
		}

		body := fmt.Sprintf("Starting in %d minutes", leadMinutes)
		if e.location != "" {
			body = fmt.Sprintf("%s at %s", body, e.location)
		}

		scheduleID := e.id
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO scheduled_notifications (title, body, url, target_role, scheduled_at, created_by, schedule_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, e.eventName, body, reminderURL, targetRole, scheduledAt, createdBy, scheduleID); err != nil {
			return nil, err
		}
		result.Created++
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}

// maxLastErrorLen bounds, in bytes, what a delivery failure can write into last_error.
const maxLastErrorLen = 500

// truncateCause cuts on a rune boundary: a byte slice through the middle of a
// multibyte character is invalid UTF-8, which Postgres rejects — and the write it
// was bound for is the one that resolves the claim.
func truncateCause(cause string) string {
	if len(cause) <= maxLastErrorLen {
		return cause
	}
	const ellipsis = "\u2026"
	cut := maxLastErrorLen - len(ellipsis)
	for cut > 0 && !utf8.RuneStart(cause[cut]) {
		cut--
	}
	return cause[:cut] + ellipsis
}

// The methods below resolve a lease taken by ClaimDue. Each guards on
// sent_at IS NULL so nothing can un-send a completed notification, and none treat
// zero rows affected as an error: the row may legitimately have been deleted
// mid-flight by the delete handler.

// MarkSent records an actual delivery and releases the lease.
func (s *ScheduledNotificationsStore) MarkSent(ctx context.Context, id string, recipientCount int) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET sent_at = now(), recipient_count = $1, claimed_at = NULL, last_error = NULL
		WHERE id = $2 AND sent_at IS NULL
	`, recipientCount, id)
	return err
}

// ReleaseClaim returns a notification to the pending pool after a retryable
// failure. The attempts counter is left as ClaimDue incremented it, so repeated
// failures still converge on MarkFailed.
func (s *ScheduledNotificationsStore) ReleaseClaim(ctx context.Context, id, cause string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET claimed_at = NULL, last_error = $1
		WHERE id = $2 AND sent_at IS NULL
	`, truncateCause(cause), id)
	return err
}

// MarkFailed gives up on a notification for good. The row stays visible with its
// reason rather than silently sitting in the pending list forever.
func (s *ScheduledNotificationsStore) MarkFailed(ctx context.Context, id, cause string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET failed_at = now(), claimed_at = NULL, last_error = $1
		WHERE id = $2 AND sent_at IS NULL
	`, truncateCause(cause), id)
	return err
}

// ReleaseUnattempted hands back claims the dispatcher never got to. ClaimDue
// charges the attempt up front so a process that dies mid-delivery still counts
// against maxAttempts, but a row deferred at the batch deadline was never tried, so
// that charge is refunded. Without this a slow push service could exhaust a
// notification's attempts one deferral at a time, without a single push sent for it.
func (s *ScheduledNotificationsStore) ReleaseUnattempted(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET claimed_at = NULL, attempts = GREATEST(attempts - 1, 0)
		WHERE id = ANY($1::uuid[]) AND sent_at IS NULL AND claimed_at IS NOT NULL
	`, ids)
	return err
}
