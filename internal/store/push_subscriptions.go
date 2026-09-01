package store

import (
	"context"
	"database/sql"
	"time"
)

type PushSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	P256dh    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PushSubscriptionsStore struct {
	db *sql.DB
}

func (s *PushSubscriptionsStore) Upsert(ctx context.Context, sub *PushSubscription) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    p256dh = EXCLUDED.p256dh,
		    auth = EXCLUDED.auth,
		    user_agent = EXCLUDED.user_agent
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		sub.UserID, sub.Endpoint, sub.P256dh, sub.Auth, sub.UserAgent,
	).Scan(&sub.ID, &sub.CreatedAt, &sub.UpdatedAt)
}

func (s *PushSubscriptionsStore) DeleteByEndpoint(ctx context.Context, userID, endpoint string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`

	result, err := s.db.ExecContext(ctx, query, userID, endpoint)
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

func (s *PushSubscriptionsStore) DeleteByEndpointAdmin(ctx context.Context, endpoint string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM push_subscriptions WHERE endpoint = $1`

	_, err := s.db.ExecContext(ctx, query, endpoint)
	return err
}

func (s *PushSubscriptionsStore) ListByRole(ctx context.Context, role *UserRole) ([]PushSubscription, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var (
		rows *sql.Rows
		err  error
	)

	if role == nil {
		query := `
			SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, ps.user_agent, ps.created_at, ps.updated_at
			FROM push_subscriptions ps
		`
		rows, err = s.db.QueryContext(ctx, query)
	} else {
		query := `
			SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, ps.user_agent, ps.created_at, ps.updated_at
			FROM push_subscriptions ps
			INNER JOIN users u ON u.id = ps.user_id
			WHERE u.role = $1
		`
		rows, err = s.db.QueryContext(ctx, query, *role)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []PushSubscription
	for rows.Next() {
		var sub PushSubscription
		if err := rows.Scan(
			&sub.ID, &sub.UserID, &sub.Endpoint, &sub.P256dh, &sub.Auth,
			&sub.UserAgent, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return subs, nil
}
