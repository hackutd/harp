package store

import (
	"context"
	"database/sql"
	"errors"
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
	CreatedBy      string     `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
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
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, created_by, created_at, updated_at
		FROM scheduled_notifications
		WHERE id = $1
	`

	var n ScheduledNotification
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&n.ID, &n.Title, &n.Body, &n.URL, &n.TargetRole, &n.ScheduledAt,
		&n.SentAt, &n.RecipientCount, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
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
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, created_by, created_at, updated_at
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
			&n.SentAt, &n.RecipientCount, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
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
		RETURNING sent_at, recipient_count, created_by, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		n.Title, n.Body, n.URL, n.TargetRole, n.ScheduledAt, n.ID,
	).Scan(&n.SentAt, &n.RecipientCount, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt)
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
		SELECT id, title, body, url, target_role, scheduled_at, sent_at, recipient_count, created_by, created_at, updated_at
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
			&n.SentAt, &n.RecipientCount, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt,
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
