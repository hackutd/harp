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

// SettingsStore handles database operations for settings
type SettingsStore struct {
	db *sql.DB
}

const SettingsKeyShortAnswerQuestions = "short_answer_questions"

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

	_, err = s.db.ExecContext(ctx, query, SettingsKeyShortAnswerQuestions, value)
	return err
}
