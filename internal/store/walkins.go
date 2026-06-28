package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type WalkIn struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	QueuedAt   time.Time  `json:"queued_at"`
	PromotedAt *time.Time `json:"promoted_at"`
	PromotedBy *string    `json:"promoted_by"`
	Email      string     `json:"email"`
	Position   int        `json:"position"`
}

type WalkInsStore struct {
	db *sql.DB
}

// Enqueue adds a user to the walk-in queue.
// Returns (inserted, position, err).
// inserted=true on first enqueue; false on re-scan or if user is already accepted.
// position is the 1-indexed FIFO position at enqueue time (only valid when inserted=true).
func (s *WalkInsStore) Enqueue(ctx context.Context, userID string) (bool, int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, 0, err
	}
	defer tx.Rollback()

	// 1. Short-circuit: already accepted, do not re-enqueue.
	var status sql.NullString
	err = tx.QueryRowContext(ctx,
		`SELECT status FROM applications WHERE user_id = $1`, userID).Scan(&status)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, 0, err
	}
	if status.Valid && status.String == string(StatusAccepted) {
		return false, 0, tx.Commit()
	}

	// 2. Insert walk_ins row; no-op on conflict (re-scan).
	res, err := tx.ExecContext(ctx,
		`INSERT INTO walk_ins (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID)
	if err != nil {
		return false, 0, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return false, 0, tx.Commit()
	}

	// 3. Upsert application to waitlisted.
	_, err = tx.ExecContext(ctx, `
		INSERT INTO applications (user_id, status, submitted_at, responses)
		VALUES ($1, 'waitlisted', NOW(), '{}')
		ON CONFLICT (user_id) DO UPDATE
		SET status = 'waitlisted',
		    submitted_at = COALESCE(applications.submitted_at, EXCLUDED.submitted_at)
	`, userID)
	if err != nil {
		return false, 0, err
	}

	// 4. Compute FIFO position for the queued email.
	var position int
	err = tx.QueryRowContext(ctx, `
		SELECT pos FROM (
			SELECT user_id,
			       ROW_NUMBER() OVER (ORDER BY queued_at ASC, id ASC)::int AS pos
			FROM walk_ins
			WHERE promoted_at IS NULL
		) ranked
		WHERE user_id = $1
	`, userID).Scan(&position)
	if err != nil {
		return false, 0, err
	}

	return true, position, tx.Commit()
}

// PromoteNext promotes the next count un-promoted walk-ins in FIFO order.
// Returns the promoted users (with name and email) so the caller can send emails.
func (s *WalkInsStore) PromoteNext(ctx context.Context, count int, promotedBy string) ([]User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Select the next N un-promoted entries, SKIP LOCKED prevents double-promotion.
	rows, err := tx.QueryContext(ctx, `
		SELECT w.id, w.user_id, u.email
		FROM walk_ins w
		JOIN users u ON u.id = w.user_id
		WHERE w.promoted_at IS NULL
		ORDER BY w.queued_at ASC, w.id ASC
		LIMIT $1
		FOR UPDATE OF w SKIP LOCKED
	`, count)
	if err != nil {
		return nil, err
	}

	type selectedRow struct {
		walkInID string
		userID   string
		email    string
	}
	var selected []selectedRow
	for rows.Next() {
		var r selectedRow
		if err := rows.Scan(&r.walkInID, &r.userID, &r.email); err != nil {
			rows.Close()
			return nil, err
		}
		selected = append(selected, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(selected) == 0 {
		return []User{}, tx.Commit()
	}

	walkInIDs := make([]string, len(selected))
	userIDs := make([]string, len(selected))
	for i, r := range selected {
		walkInIDs[i] = r.walkInID
		userIDs[i] = r.userID
	}

	// Stamp promoted_at on all selected walk_ins rows.
	_, err = tx.ExecContext(ctx, `
		UPDATE walk_ins
		SET promoted_at = NOW(), promoted_by = $1
		WHERE id = ANY($2::uuid[])
	`, promotedBy, walkInIDs)
	if err != nil {
		return nil, err
	}

	// Bulk flip application status to accepted (happy path — Enqueue always pre-creates rows).
	_, err = tx.ExecContext(ctx, `
		UPDATE applications SET status = 'accepted', updated_at = NOW()
		WHERE user_id = ANY($1::uuid[])
	`, userIDs)
	if err != nil {
		return nil, err
	}

	// Defensive fallback: upsert for any user_id not covered by the bulk UPDATE.
	for _, uid := range userIDs {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO applications (user_id, status, submitted_at, responses)
			VALUES ($1, 'accepted', NOW(), '{}')
			ON CONFLICT (user_id) DO UPDATE
			SET status = 'accepted',
			    submitted_at = COALESCE(applications.submitted_at, EXCLUDED.submitted_at)
		`, uid)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	promoted := make([]User, len(selected))
	for i, r := range selected {
		promoted[i] = User{ID: r.userID, Email: r.email}
	}
	return promoted, nil
}

// QueueDepth returns the pending (un-promoted) count and total count of walk-in entries.
func (s *WalkInsStore) QueueDepth(ctx context.Context) (int, int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var pending, total int
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE promoted_at IS NULL),
			COUNT(*)
		FROM walk_ins
	`).Scan(&pending, &total)
	if err != nil {
		return 0, 0, err
	}
	return pending, total, nil
}

// List returns all un-promoted walk-in entries ordered by arrival time, with live positions.
func (s *WalkInsStore) List(ctx context.Context) ([]WalkIn, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			w.id, w.user_id, w.queued_at, w.promoted_at, w.promoted_by,
			u.email,
			ROW_NUMBER() OVER (ORDER BY w.queued_at ASC, w.id ASC)::int AS position
		FROM walk_ins w
		JOIN users u ON u.id = w.user_id
		WHERE w.promoted_at IS NULL
		ORDER BY w.queued_at ASC, w.id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []WalkIn
	for rows.Next() {
		var w WalkIn
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.QueuedAt, &w.PromotedAt, &w.PromotedBy,
			&w.Email, &w.Position,
		); err != nil {
			return nil, err
		}
		result = append(result, w)
	}

	if result == nil {
		result = []WalkIn{}
	}

	return result, rows.Err()
}
