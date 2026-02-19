package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
)

// ShortAnswerQuestion represents a single configurable question
type ShortAnswerQuestion struct {
	ID           string `json:"id" validate:"required,min=1,max=50"`
	Question     string `json:"question" validate:"required,min=1,max=500"`
	Required     bool   `json:"required"`
	DisplayOrder int    `json:"display_order" validate:"min=0"`
}

// SettingsStore handles database operations for hackathon settings (e.g., short answer questions)
type SettingsStore struct {
	db *sql.DB
}

const SettingsKeyShortAnswerQuestions = "short_answer_questions"
const SettingsKeyReviewsPerApplication = "reviews_per_application"
const SettingsKeyReviewAssignmentEnabled = "review_assignment_enabled"

// GetShortAnswerQuestions returns the parsed questions array
func (s *SettingsStore) GetShortAnswerQuestions(ctx context.Context) ([]ShortAnswerQuestion, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyShortAnswerQuestions).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []ShortAnswerQuestion{}, nil
		}
		return nil, err
	}

	var questions []ShortAnswerQuestion
	if err := json.Unmarshal(value, &questions); err != nil {
		return nil, err
	}

	return questions, nil
}

// GetReviewsPerApplication returns the configured number of reviews per application
func (s *SettingsStore) GetReviewsPerApplication(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyReviewsPerApplication).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 3, nil
		}
		return 0, err
	}

	var count int
	if err := json.Unmarshal(value, &count); err != nil {
		return 0, err
	}

	return count, nil
}

// SetReviewsPerApplication updates the number of reviews required per application
func (s *SettingsStore) SetReviewsPerApplication(ctx context.Context, value int) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(value)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyReviewsPerApplication, string(jsonValue))
	return err
}

// UpdateShortAnswerQuestions replaces all questions with the provided array
func (s *SettingsStore) UpdateShortAnswerQuestions(ctx context.Context, questions []ShortAnswerQuestion) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(questions)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyShortAnswerQuestions, string(value))
	return err
}

// GetReviewAssignmentEnabled returns whether review assignment is enabled for the given super admin ID.
// The setting is stored as a JSON array of super admin IDs who have enabled review assignment.
// If the setting row does not exist, defaults to false.
func (s *SettingsStore) GetReviewAssignmentEnabled(ctx context.Context, superAdminID string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyReviewAssignmentEnabled).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	var ids []string
	if err := json.Unmarshal(value, &ids); err != nil {
		return false, err
	}

	for _, id := range ids {
		if id == superAdminID {
			return true, nil
		}
	}

	return false, nil
}

// SetReviewAssignmentEnabled updates whether review assignment is enabled for the given super admin ID.
// The setting is stored as a JSON array of super admin IDs who have enabled review assignment.
// If `enabled` is true the super admin ID will be added to the array if missing. If false it will be removed.
func (s *SettingsStore) SetReviewAssignmentEnabled(ctx context.Context, superAdminID string, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// load current array (if any)
	querySelect := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, querySelect, SettingsKeyReviewAssignmentEnabled).Scan(&value)
	var ids []string
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		ids = []string{}
	} else {
		if err := json.Unmarshal(value, &ids); err != nil {
			return err
		}
	}

	found := false
	for i, id := range ids {
		if id == superAdminID {
			found = true
			if !enabled {
				// remove it
				ids = append(ids[:i], ids[i+1:]...)
			}
			break
		}
	}
	if enabled && !found {
		ids = append(ids, superAdminID)
	}

	jsonValue, err := json.Marshal(ids)
	if err != nil {
		return err
	}

	queryUpsert := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, queryUpsert, SettingsKeyReviewAssignmentEnabled, string(jsonValue))
	return err
}
