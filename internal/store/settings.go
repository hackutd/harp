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
const SettingsKeyScanTypes = "scan_types"
const SettingsKeyScanStats = "scan_stats"

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

	_, err = s.db.ExecContext(ctx, query, SettingsKeyReviewsPerApplication, jsonValue)
	return err
}

// GetScanTypes returns the configured scan types
func (s *SettingsStore) GetScanTypes(ctx context.Context) ([]ScanType, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyScanTypes).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []ScanType{}, nil
		}
		return nil, err
	}

	var scanTypes []ScanType
	if err := json.Unmarshal(value, &scanTypes); err != nil {
		return nil, err
	}

	return scanTypes, nil
}

// UpdateScanTypes replaces all scan types with the provided array
func (s *SettingsStore) UpdateScanTypes(ctx context.Context, scanTypes []ScanType) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(scanTypes)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyScanTypes, value)
	return err
}

// GetScanStats returns the scan stats counter cache as a map of scan_type -> count
func (s *SettingsStore) GetScanStats(ctx context.Context) (map[string]int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT value FROM settings WHERE key = $1`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyScanStats).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]int{}, nil
		}
		return nil, err
	}

	var stats map[string]int
	if err := json.Unmarshal(value, &stats); err != nil {
		return nil, err
	}

	return stats, nil
}

// incrementScanStat atomically increments the counter for a scan type within an existing transaction.
func incrementScanStat(ctx context.Context, tx *sql.Tx, scanType string) error {
	query := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

	var value []byte
	err := tx.QueryRowContext(ctx, query, SettingsKeyScanStats).Scan(&value)
	if err != nil {
		return err
	}

	var stats map[string]int
	if err := json.Unmarshal(value, &stats); err != nil {
		return err
	}

	stats[scanType]++

	updated, err := json.Marshal(stats)
	if err != nil {
		return err
	}

	updateQuery := `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`
	_, err = tx.ExecContext(ctx, updateQuery, updated, SettingsKeyScanStats)
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

	_, err = s.db.ExecContext(ctx, query, SettingsKeyShortAnswerQuestions, value)
	return err
}
