package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// pendingReferralTTL bounds how long a code recorded at sign-in waits for its
// user row. UsersStore.Create ignores an older one, and RecordPending deletes
// them so abandoned sign-ins don't keep emails around.
const pendingReferralTTL = 7 * 24 * time.Hour

type Referral struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	VisitCount  int       `json:"visit_count"`
	SignupCount int       `json:"signup_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ReferralSignup struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type ReferralsStore struct {
	db *sql.DB
}

func (s *ReferralsStore) List(ctx context.Context) ([]Referral, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT r.id, r.name, r.code, r.visit_count, COUNT(u.id), r.created_at, r.updated_at
		FROM referrals r
		LEFT JOIN users u ON u.referral_id = r.id
		GROUP BY r.id
		ORDER BY r.created_at DESC, r.name ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var referrals []Referral
	for rows.Next() {
		var ref Referral
		if err := rows.Scan(
			&ref.ID,
			&ref.Name,
			&ref.Code,
			&ref.VisitCount,
			&ref.SignupCount,
			&ref.CreatedAt,
			&ref.UpdatedAt,
		); err != nil {
			return nil, err
		}
		referrals = append(referrals, ref)
	}
	if referrals == nil {
		referrals = []Referral{}
	}
	return referrals, rows.Err()
}

// Create inserts a referral. A code already in use returns ErrConflict.
func (s *ReferralsStore) Create(ctx context.Context, ref *Referral) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO referrals (name, code)
		VALUES ($1, $2)
		RETURNING id, code, visit_count, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, ref.Name, ref.Code).
		Scan(&ref.ID, &ref.Code, &ref.VisitCount, &ref.CreatedAt, &ref.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	ref.SignupCount = 0
	return nil
}

// Update renames a referral and/or changes its code. Changing the code breaks
// links already handed out; signups already attributed are kept.
func (s *ReferralsStore) Update(ctx context.Context, ref *Referral) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		WITH updated AS (
			UPDATE referrals
			SET name = $1, code = $2
			WHERE id = $3
			RETURNING id, code, visit_count, created_at, updated_at
		)
		SELECT updated.code, updated.visit_count, updated.created_at, updated.updated_at,
			(SELECT COUNT(*) FROM users WHERE referral_id = updated.id)
		FROM updated
	`

	err := s.db.QueryRowContext(ctx, query, ref.Name, ref.Code, ref.ID).
		Scan(&ref.Code, &ref.VisitCount, &ref.CreatedAt, &ref.UpdatedAt, &ref.SignupCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	return nil
}

// Delete removes a referral. Users who signed up through it keep their
// accounts and lose the attribution.
func (s *ReferralsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	result, err := s.db.ExecContext(ctx, `DELETE FROM referrals WHERE id = $1`, id)
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

// ListSignups returns the users who signed up through a referral, newest first.
func (s *ReferralsStore) ListSignups(ctx context.Context, id string) ([]ReferralSignup, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var exists bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM referrals WHERE id = $1)`, id).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	query := `
		SELECT id, email, created_at
		FROM users
		WHERE referral_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	signups := []ReferralSignup{}
	for rows.Next() {
		var su ReferralSignup
		if err := rows.Scan(&su.UserID, &su.Email, &su.CreatedAt); err != nil {
			return nil, err
		}
		signups = append(signups, su)
	}
	return signups, rows.Err()
}

// RecordVisit counts one landing on a referral link. An unknown code is not
// an error: links get mistyped and deleted, and the caller is anonymous.
func (s *ReferralsStore) RecordVisit(ctx context.Context, code string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `UPDATE referrals SET visit_count = visit_count + 1 WHERE code = $1`, code)
	return err
}

// RecordPending holds a referral code for an email that is signing in, until
// UsersStore.Create claims it. It does nothing for an unknown code or for an
// email that already has an account, so only genuinely new users are credited.
// The latest link wins if the same person follows several before signing up.
func (s *ReferralsStore) RecordPending(ctx context.Context, email, code string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	if _, err := s.db.ExecContext(ctx,
		`DELETE FROM pending_referrals WHERE created_at < $1`,
		time.Now().Add(-pendingReferralTTL),
	); err != nil {
		return err
	}

	query := `
		INSERT INTO pending_referrals (email, referral_id)
		SELECT $1, id FROM referrals
		WHERE code = $2
			AND NOT EXISTS (SELECT 1 FROM users WHERE email = $1)
		ON CONFLICT (email) DO UPDATE
		SET referral_id = EXCLUDED.referral_id, created_at = now()
	`

	_, err := s.db.ExecContext(ctx, query, email, code)
	return err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
