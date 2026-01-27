package store

import (
	"context"
	"database/sql"
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

	query := `
		INSERT INTO users (supertokens_user_id, email, role, auth_method, profile_picture_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRowContext(
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

	return nil
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
