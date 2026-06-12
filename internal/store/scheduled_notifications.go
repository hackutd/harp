package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

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
	CreatedBy      string     `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
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
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at
		FROM scheduled_notifications
		WHERE id = $1
	`

	var n ScheduledNotification
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
		&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
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
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at
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

	query := `
		UPDATE scheduled_notifications
		SET title = $1, body = $2, url = $3, target_role = $4, scheduled_at = $5
		WHERE id = $6 AND sent_at IS NULL
		RETURNING sent_at, recipient_count, schedule_id, created_by, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		n.Title, n.Body, n.URL, n.TargetRole, n.ScheduledAt, n.ID,
	).Scan(&n.SentAt, &n.RecipientCount, &n.ScheduleID, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Could be not found or already sent — distinguish
			var exists bool
			if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM scheduled_notifications WHERE id = $1)`, n.ID).Scan(&exists); err != nil {
				return err
			}
			if exists {
				return ErrConflict
			}
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *ScheduledNotificationsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	result, err := s.db.ExecContext(ctx, `DELETE FROM scheduled_notifications WHERE id = $1 AND sent_at IS NULL`, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		var exists bool
		if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM scheduled_notifications WHERE id = $1)`, id).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return ErrConflict
		}
		return ErrNotFound
	}

	return nil
}

func (s *ScheduledNotificationsStore) ClaimDue(ctx context.Context, now time.Time, limit int) ([]ScheduledNotification, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by, created_at, updated_at
		FROM scheduled_notifications
		WHERE scheduled_at <= $1 AND sent_at IS NULL
		ORDER BY scheduled_at
		FOR UPDATE SKIP LOCKED
		LIMIT $2
	`, now, limit)
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
		SET sent_at = now()
		WHERE id = ANY($1::uuid[])
	`, ids); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return claimed, nil
}

// GenerateFromSchedule (re)builds reminder notifications from the current schedule.
//
// For every schedule item it derives a reminder scheduled `lead` before the event's
// start time. Pending (unsent) schedule-sourced notifications are cleared first so that
// repeated runs are idempotent and reflect the latest schedule and lead time. Already-sent
// notifications and manually-created ones (schedule_id IS NULL) are left untouched.
// Reminders whose computed send time has already passed are skipped.
func (s *ScheduledNotificationsStore) GenerateFromSchedule(ctx context.Context, lead time.Duration, targetRole *UserRole, createdBy string, now time.Time) (*ScheduleNotificationGenerationResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Clear pending schedule-sourced reminders so a re-run reflects the latest schedule.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM scheduled_notifications
		WHERE schedule_id IS NOT NULL AND sent_at IS NULL
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

func (s *ScheduledNotificationsStore) MarkSent(ctx context.Context, id string, recipientCount int) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE scheduled_notifications
		SET recipient_count = $1
		WHERE id = $2
	`, recipientCount, id)
	return err
}
