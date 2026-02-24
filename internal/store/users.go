package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type UserRole string

const (
	RoleHacker     UserRole = "hacker"
	RoleAdmin      UserRole = "admin"
	RoleSuperAdmin UserRole = "super_admin"
)

type AuthMethod string

const (
	AuthMethodPasswordless AuthMethod = "passwordless"
	AuthMethodGoogle       AuthMethod = "google"
)

type User struct {
	ID                string     `json:"id"`
	SuperTokensUserID string     `json:"supertokens_user_id" validate:"required"`
	Email             string     `json:"email" validate:"required,email"`
	Role              UserRole   `json:"role" validate:"required,oneof=hacker admin super_admin"`
	AuthMethod        AuthMethod `json:"auth_method" validate:"required,oneof=passwordless google"`
	ProfilePictureURL *string    `json:"profile_picture_url,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type UsersStore struct {
	db *sql.DB
}

func (s *UsersStore) GetBySuperTokensID(ctx context.Context, supertokensUserID string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, supertokens_user_id, email, role, auth_method, profile_picture_url, created_at, updated_at
		FROM users
		WHERE supertokens_user_id = $1
	`

	var user User
	err := s.db.QueryRowContext(ctx, query, supertokensUserID).Scan(
		&user.ID,
		&user.SuperTokensUserID,
		&user.Email,
		&user.Role,
		&user.AuthMethod,
		&user.ProfilePictureURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (s *UsersStore) GetByID(ctx context.Context, id string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, supertokens_user_id, email, role, auth_method, profile_picture_url, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user User
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.SuperTokensUserID,
		&user.Email,
		&user.Role,
		&user.AuthMethod,
		&user.ProfilePictureURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (s *UsersStore) Create(ctx context.Context, user *User) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO users (supertokens_user_id, email, role, auth_method, profile_picture_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	err = tx.QueryRowContext(
		ctx,
		query,
		user.SuperTokensUserID,
		user.Email,
		user.Role,
		user.AuthMethod,
		user.ProfilePictureURL,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "users_email_key") {
			return ErrConflict
		}
		return err
	}

	// If the newly-created user is an admin or super_admin, ensure an entry
	// exists in the `review_assignment_enabled` settings JSONB array with
	// enabled=true for admins and enabled=false for super_admins.
	if user.Role == RoleAdmin || user.Role == RoleSuperAdmin {
		defaultEnabled := user.Role == RoleAdmin

		querySelect := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

		var value []byte
		err = tx.QueryRowContext(ctx, querySelect, SettingsKeyReviewAssignmentEnabled).Scan(&value)

		var entries []ReviewAssignmentEntry
		if err != nil {
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			// no settings row yet; create with this admin/super_admin
			entries = []ReviewAssignmentEntry{{ID: user.ID, Enabled: defaultEnabled}}
		} else {
			// Try to parse new format
			if jerr := json.Unmarshal(value, &entries); jerr != nil {
				// Fallback: try legacy array of ids
				var ids []string
				if jerr2 := json.Unmarshal(value, &ids); jerr2 == nil {
					for _, id := range ids {
						entries = append(entries, ReviewAssignmentEntry{ID: id, Enabled: true})
					}
				} else {
					entries = []ReviewAssignmentEntry{}
				}
			}

			// Ensure entry exists
			found := false
			for _, e := range entries {
				if e.ID == user.ID {
					found = true
					break
				}
			}
			if !found {
				entries = append(entries, ReviewAssignmentEntry{ID: user.ID, Enabled: defaultEnabled})
			}
		}

		jsonValue, err := json.Marshal(entries)
		if err != nil {
			return err
		}

		queryUpsert := `
			INSERT INTO settings (key, value)
			VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`

		if _, err := tx.ExecContext(ctx, queryUpsert, SettingsKeyReviewAssignmentEnabled, string(jsonValue)); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *UsersStore) GetByEmail(ctx context.Context, email string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, supertokens_user_id, email, role, auth_method, profile_picture_url, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user User
	err := s.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.SuperTokensUserID,
		&user.Email,
		&user.Role,
		&user.AuthMethod,
		&user.ProfilePictureURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (s *UsersStore) UpdateProfilePicture(ctx context.Context, supertokensUserID string, pictureURL *string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE users
		SET profile_picture_url = $1, updated_at = NOW()
		WHERE supertokens_user_id = $2
	`

	result, err := s.db.ExecContext(ctx, query, pictureURL, supertokensUserID)
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
