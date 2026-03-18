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

	// If the newly-created user is a super_admin, ensure an entry
	// exists in the `review_assignment_toggle` settings JSONB array with
	// enabled=true. Admins are always assigned reviews and don't need a toggle entry.
	if user.Role == RoleSuperAdmin {
		defaultEnabled := true

		querySelect := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

		var value []byte
		err = tx.QueryRowContext(ctx, querySelect, SettingsKeyReviewAssignmentToggle).Scan(&value)

		var entries []ReviewAssignmentEntry
		if err != nil {
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			// no settings row yet; create with this admin/super_admin
			entries = []ReviewAssignmentEntry{{ID: user.ID, Enabled: defaultEnabled}}
		} else {
			parsed, parseErr := parseReviewAssignmentEntries(value)
			if parseErr != nil {
				entries = []ReviewAssignmentEntry{}
			} else {
				entries = parsed
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

		if _, err := tx.ExecContext(ctx, queryUpsert, SettingsKeyReviewAssignmentToggle, string(jsonValue)); err != nil {
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

// UserListItem is a lightweight user view for search results
type UserListItem struct {
	ID                string    `json:"id"`
	Email             string    `json:"email"`
	Role              UserRole  `json:"role"`
	FirstName         *string   `json:"first_name"`
	LastName          *string   `json:"last_name"`
	ProfilePictureURL *string   `json:"profile_picture_url,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// UserSearchResult contains paginated user search results
type UserSearchResult struct {
	Users      []UserListItem `json:"users"`
	TotalCount int            `json:"total_count"`
}

func (s *UsersStore) Search(ctx context.Context, query string, limit int, offset int) (*UserSearchResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	countQuery := `
		SELECT COUNT(*)
		FROM users u
		LEFT JOIN applications a ON a.user_id = u.id
		WHERE u.email ILIKE '%' || $1 || '%'
		   OR a.first_name ILIKE '%' || $1 || '%'
		   OR a.last_name ILIKE '%' || $1 || '%'
	`

	var totalCount int
	if err := s.db.QueryRowContext(ctx, countQuery, query).Scan(&totalCount); err != nil {
		return nil, err
	}

	searchQuery := `
		SELECT u.id, u.email, u.role, a.first_name, a.last_name, u.profile_picture_url, u.created_at
		FROM users u
		LEFT JOIN applications a ON a.user_id = u.id
		WHERE u.email ILIKE '%' || $1 || '%'
		   OR a.first_name ILIKE '%' || $1 || '%'
		   OR a.last_name ILIKE '%' || $1 || '%'
		ORDER BY u.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, searchQuery, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]UserListItem, 0, limit)
	for rows.Next() {
		var u UserListItem
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.FirstName, &u.LastName, &u.ProfilePictureURL, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &UserSearchResult{Users: users, TotalCount: totalCount}, nil
}

func (s *UsersStore) UpdateRole(ctx context.Context, userID string, role UserRole) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE users
		SET role = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, supertokens_user_id, email, role, auth_method, profile_picture_url, created_at, updated_at
	`

	var user User
	err := s.db.QueryRowContext(ctx, query, userID, role).Scan(
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

func (s *UsersStore) GetByRole(ctx context.Context, role UserRole) ([]User, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, supertokens_user_id, email, role, auth_method, profile_picture_url, created_at, updated_at
		FROM users
		WHERE role = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.SuperTokensUserID, &user.Email, &user.Role, &user.AuthMethod, &user.ProfilePictureURL, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
