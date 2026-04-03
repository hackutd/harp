package store

import (
	"context"
	"database/sql"
)

type HackathonStore struct {
	db *sql.DB
}

// Reset resets the selected domains of hackathon data in a single transaction.
// Returns a list of resume paths that should be deleted from storage if applications were reset.
func (s *HackathonStore) Reset(ctx context.Context, resetApplications, resetScans, resetSchedule, resetSettings bool) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2) // Longer timeout for bulk operations
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var resumePaths []string

	if resetApplications {
		// Collect resume paths before truncation
		rows, err := tx.QueryContext(ctx, "SELECT resume_path FROM applications WHERE resume_path IS NOT NULL")
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		for rows.Next() {
			var path string
			if err := rows.Scan(&path); err != nil {
				return nil, err
			}
			resumePaths = append(resumePaths, path)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		rows.Close()

		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE applications CASCADE"); err != nil {
			return nil, err
		}
	}

	if resetScans {
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE scans"); err != nil {
			return nil, err
		}
	}

	if resetSchedule {
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE schedule"); err != nil {
			return nil, err
		}
	}

	if resetSettings {
		if _, err := tx.ExecContext(ctx, "UPDATE settings SET value = '{}', updated_at = NOW() WHERE key = $1", SettingsKeyScanStats); err != nil {
			return nil, err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE settings SET value = '[]', updated_at = NOW() WHERE key = $1", SettingsKeyReviewAssignmentToggle); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return resumePaths, nil
}
