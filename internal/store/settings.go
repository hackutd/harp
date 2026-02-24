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
const SettingsKeyScanTypes = "scan_types"
const SettingsKeyScanStats = "scan_stats"

// ReviewAssignmentEntry represents a single admin's review assignment toggle state.
// Used in the review_assignment_enabled settings JSON array.
type ReviewAssignmentEntry struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

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

	// Treat empty/empty-object/empty-array as disabled
	sv := string(value)
	if sv == "" || sv == "null" || sv == "{}" || sv == "[]" {
		return false, nil
	}

	// New format: array of objects {"id": "...", "enabled": true}
	var entries []ReviewAssignmentEntry
	if err := json.Unmarshal(value, &entries); err == nil {
		for _, e := range entries {
			if e.ID == superAdminID && e.Enabled {
				return true, nil
			}
		}
		return false, nil
	}

	// Fallback: legacy format was an array of IDs (strings)
	var ids []string
	if err := json.Unmarshal(value, &ids); err == nil {
		for _, id := range ids {
			if id == superAdminID {
				return true, nil
			}
		}
		return false, nil
	}

	return false, nil
}

// SetReviewAssignmentEnabled updates whether review assignment is enabled for the given super admin ID.
// The setting is stored as a JSON array of super admin IDs who have enabled review assignment.
// If `enabled` is true the super admin ID will be added to the array if missing. If false it will be removed.
func (s *SettingsStore) SetReviewAssignmentEnabled(ctx context.Context, superAdminID string, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// load current array (if any) with FOR UPDATE to prevent concurrent overwrites
	querySelect := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

	var value []byte
	err = tx.QueryRowContext(ctx, querySelect, SettingsKeyReviewAssignmentEnabled).Scan(&value)

	var entries []ReviewAssignmentEntry

	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		entries = []ReviewAssignmentEntry{}
	} else {
		// Try new format first
		if jerr := json.Unmarshal(value, &entries); jerr != nil {
			// Fallback: legacy array of IDs
			var ids []string
			if jerr2 := json.Unmarshal(value, &ids); jerr2 == nil {
				// convert legacy ids to entries with enabled=true
				for _, id := range ids {
					entries = append(entries, ReviewAssignmentEntry{ID: id, Enabled: true})
				}
			} else {
				// If we can't parse either, start fresh
				entries = []ReviewAssignmentEntry{}
			}
		}
	}

	found := false
	for i, e := range entries {
		if e.ID == superAdminID {
			found = true
			entries[i].Enabled = enabled
			break
		}
	}
	if !found {
		entries = append(entries, ReviewAssignmentEntry{ID: superAdminID, Enabled: enabled})
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

	return tx.Commit()
}
