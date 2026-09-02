package store

import (
	"context"
	"database/sql"
)

type HackathonStore struct {
	db *sql.DB
	// settings is held only so a reset can drop the settings cache: the reset
	// writes applications_enabled and friends straight through its own
	// transaction, where the store's own invalidation never runs.
	settings *SettingsStore
}

// ResetOptions selects which domains of hackathon data a reset clears.
type ResetOptions struct {
	Applications  bool
	Scans         bool
	ScanTypes     bool
	Schedule      bool
	Notifications bool
	Settings      bool
	Sponsors      bool
	FAQs          bool
	Config        bool
}

// Any reports whether at least one domain is selected.
func (o ResetOptions) Any() bool {
	return o.Applications || o.Scans || o.ScanTypes || o.Schedule ||
		o.Notifications || o.Settings || o.Sponsors || o.FAQs || o.Config
}

// ResetPaths holds the storage objects a reset orphaned, by kind, so the caller
// can delete them once the rows pointing at them are gone.
type ResetPaths struct {
	Resumes        []string
	TravelReceipts []string
}

// Reset resets the selected domains of hackathon data in a single transaction.
// Returns the uploaded files that should be deleted from storage if
// applications were reset.
func (s *HackathonStore) Reset(ctx context.Context, opts ResetOptions) (*ResetPaths, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2) // Longer timeout for bulk operations
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	paths := &ResetPaths{}

	if opts.Applications {
		// Collect uploaded file paths before truncation
		paths.Resumes, err = collectResumePaths(ctx, tx)
		if err != nil {
			return nil, err
		}

		paths.TravelReceipts, err = collectTravelReceiptPaths(ctx, tx)
		if err != nil {
			return nil, err
		}

		// CASCADE picks up application_reviews. walk_ins is listed explicitly:
		// it references users rather than applications, so nothing cascades to
		// it, yet every walk-in row owns the waitlisted application it created.
		// Leaving the queue behind would orphan those rows and permanently
		// block re-queuing, since Enqueue inserts ON CONFLICT (user_id) DO NOTHING.
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE applications, walk_ins CASCADE"); err != nil {
			return nil, err
		}

		// Do not leave the public form open against an empty application table.
		// A full reset also closes it through resetHackathonConfig below, but the
		// applications option is independently callable.
		if !opts.Config {
			if err := closeApplications(ctx, tx); err != nil {
				return nil, err
			}
		}
	}

	if opts.Scans {
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE scans"); err != nil {
			return nil, err
		}
	}

	if opts.ScanTypes {
		if err := resetScanTypes(ctx, tx); err != nil {
			return nil, err
		}
	}

	if opts.Schedule {
		// DELETE, not TRUNCATE: scheduled_notifications.schedule_id references
		// schedule, and only DELETE fires its ON DELETE CASCADE.
		if _, err := tx.ExecContext(ctx, "DELETE FROM schedule"); err != nil {
			return nil, err
		}
	}

	if opts.Notifications {
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE scheduled_notifications"); err != nil {
			return nil, err
		}
	}

	if opts.Sponsors {
		// Logos live in the logo_data column as base64, so they go with the row.
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE sponsors"); err != nil {
			return nil, err
		}
	}

	if opts.FAQs {
		if _, err := tx.ExecContext(ctx, "TRUNCATE TABLE faqs"); err != nil {
			return nil, err
		}
	}

	// scan_stats is a denormalized cache of the scans table, so it has to go
	// whenever the rows it counts do — otherwise the dashboard keeps reporting
	// check-in and meal counts for scans that no longer exist. Dropping a scan
	// type also strands its bucket in the cache.
	if opts.Scans || opts.ScanTypes || opts.Settings {
		if err := resetScanStats(ctx, tx); err != nil {
			return nil, err
		}
	}

	if opts.Settings {
		if err := resetReviewAssignmentToggle(ctx, tx); err != nil {
			return nil, err
		}
	}

	if opts.Config {
		if err := resetHackathonConfig(ctx, tx); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	if s.settings != nil {
		s.settings.invalidateAll()
	}

	return paths, nil
}

// collectResumePaths reads every non-empty resume path so the objects can be
// removed from storage once the rows pointing at them are gone.
func collectResumePaths(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := tx.QueryContext(ctx, "SELECT resume_path FROM applications WHERE resume_path IS NOT NULL AND resume_path <> ''")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}

	return paths, rows.Err()
}

// collectTravelReceiptPaths reads every uploaded travel receipt so the objects
// can be removed from storage along with the applications that referenced them.
func collectTravelReceiptPaths(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := tx.QueryContext(ctx,
		"SELECT UNNEST(travel_receipt_paths) FROM applications WHERE ARRAY_LENGTH(travel_receipt_paths, 1) > 0")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}

	return paths, rows.Err()
}
