package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

type ScanTypeCategory string

const (
	ScanCategoryCheckIn ScanTypeCategory = "check_in"
	ScanCategoryMeal    ScanTypeCategory = "meal"
	ScanCategorySwag    ScanTypeCategory = "swag"
	ScanCategoryOther   ScanTypeCategory = "other"
	ScanCategoryWalkIn  ScanTypeCategory = "walk_in"
	ScanCategoryShop    ScanTypeCategory = "shop"
)

type ScanType struct {
	Name        string           `json:"name" validate:"required,min=1,max=50"`
	DisplayName string           `json:"display_name" validate:"required,min=1,max=100"`
	Category    ScanTypeCategory `json:"category" validate:"required,oneof=check_in meal swag other walk_in shop"`
	IsActive    bool             `json:"is_active"`
	Points      int              `json:"points" validate:"min=0"`
}

type Scan struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	ScanType string `json:"scan_type"`
	// Nil once the staff account that performed the scan is deleted; the scan
	// itself belongs to the hacker and outlives them.
	ScannedBy *string   `json:"scanned_by"`
	Points    int       `json:"points"`
	ScannedAt time.Time `json:"scanned_at"`
	CreatedAt time.Time `json:"created_at"`
}

type ScanStat struct {
	ScanType string `json:"scan_type"`
	Count    int    `json:"count"`
}

type ScansStore struct {
	db *sql.DB
}

func (s *ScansStore) Create(ctx context.Context, scan *Scan) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO scans (user_id, scan_type, scanned_by, points)
		VALUES ($1, $2, $3, $4)
		RETURNING id, scanned_at, created_at
	`

	err = tx.QueryRowContext(ctx, query, scan.UserID, scan.ScanType, scan.ScannedBy, scan.Points).
		Scan(&scan.ID, &scan.ScannedAt, &scan.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "23505":
				return ErrConflict
			case "23503":
				return ErrNotFound
			}
		}
		return err
	}

	if err := incrementScanStat(ctx, tx, scan.ScanType); err != nil {
		return err
	}

	return tx.Commit()
}

// CreatePurchase inserts a repeatable scan with negative points after verifying
// the user's balance covers the cost. Returns the resulting balance. A
// per-user advisory lock serializes concurrent purchases so two scans cannot
// both pass the balance check; concurrent awards only increase the balance so
// they cannot invalidate a passed check.
func (s *ScansStore) CreatePurchase(ctx context.Context, scan *Scan) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, scan.UserID); err != nil {
		return 0, err
	}

	var balance int
	err = tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(points), 0) FROM scans WHERE user_id = $1`, scan.UserID).
		Scan(&balance)
	if err != nil {
		return 0, err
	}

	if balance+scan.Points < 0 {
		return balance, ErrInsufficientPoints
	}

	query := `
		INSERT INTO scans (user_id, scan_type, scanned_by, points, repeatable)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING id, scanned_at, created_at
	`

	err = tx.QueryRowContext(ctx, query, scan.UserID, scan.ScanType, scan.ScannedBy, scan.Points).
		Scan(&scan.ID, &scan.ScannedAt, &scan.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return 0, ErrNotFound
		}
		return 0, err
	}

	if err := incrementScanStat(ctx, tx, scan.ScanType); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return balance + scan.Points, nil
}

func (s *ScansStore) GetByUserID(ctx context.Context, userID string) ([]Scan, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, user_id, scan_type, scanned_by, points, scanned_at, created_at
		FROM scans
		WHERE user_id = $1
		ORDER BY scanned_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scans []Scan
	for rows.Next() {
		var scan Scan
		if err := rows.Scan(&scan.ID, &scan.UserID, &scan.ScanType, &scan.ScannedBy, &scan.Points, &scan.ScannedAt, &scan.CreatedAt); err != nil {
			return nil, err
		}
		scans = append(scans, scan)
	}

	if scans == nil {
		scans = []Scan{}
	}

	return scans, rows.Err()
}

func (s *ScansStore) GetStats(ctx context.Context) ([]ScanStat, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT value FROM settings WHERE key = $1`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyScanStats).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []ScanStat{}, nil
		}
		return nil, err
	}

	var statsMap map[string]int
	if err := json.Unmarshal(value, &statsMap); err != nil {
		return nil, err
	}

	stats := make([]ScanStat, 0, len(statsMap))
	for scanType, count := range statsMap {
		stats = append(stats, ScanStat{ScanType: scanType, Count: count})
	}

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].ScanType < stats[j].ScanType
	})

	return stats, nil
}

func (s *ScansStore) HasCheckIn(ctx context.Context, userID string, checkInTypes []string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	if len(checkInTypes) == 0 {
		return false, nil
	}

	query := `
		SELECT EXISTS(
			SELECT 1 FROM scans
			WHERE user_id = $1 AND scan_type = ANY($2)
		)
	`

	var exists bool
	err := s.db.QueryRowContext(ctx, query, userID, checkInTypes).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists, nil
}

// GetTotalPointsByUserID returns the sum of points across all of a user's scans.
func (s *ScansStore) GetTotalPointsByUserID(ctx context.Context, userID string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT COALESCE(SUM(points), 0) FROM scans WHERE user_id = $1`

	var total int
	if err := s.db.QueryRowContext(ctx, query, userID).Scan(&total); err != nil {
		return 0, err
	}

	return total, nil
}

// RebalanceStats recomputes the scan_stats counter cache from the authoritative
// scans table and returns the recomputed stats (sorted by scan_type, matching
// GetStats).
//
// Concurrency caveat: a scan insert that commits between the COUNT(*) query and
// the FOR UPDATE lock acquisition could be missed. This is acceptable for a
// manually triggered rebalance.
func (s *ScansStore) RebalanceStats(ctx context.Context) ([]ScanStat, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	statsMap, err := rebalanceScanStats(ctx, tx)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	stats := make([]ScanStat, 0, len(statsMap))
	for scanType, count := range statsMap {
		stats = append(stats, ScanStat{ScanType: scanType, Count: count})
	}

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].ScanType < stats[j].ScanType
	})

	return stats, nil
}
