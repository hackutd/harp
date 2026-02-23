package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

type ScanTypeCategory string

const (
	ScanCategoryCheckIn ScanTypeCategory = "check_in"
	ScanCategoryMeal    ScanTypeCategory = "meal"
	ScanCategorySwag    ScanTypeCategory = "swag"
)

type ScanType struct {
	Name        string           `json:"name" validate:"required,min=1,max=50"`
	DisplayName string           `json:"display_name" validate:"required,min=1,max=100"`
	Category    ScanTypeCategory `json:"category" validate:"required,oneof=check_in meal swag"`
	IsActive    bool             `json:"is_active"`
}

type Scan struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ScanType  string    `json:"scan_type"`
	ScannedBy string    `json:"scanned_by"`
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

	query := `
		INSERT INTO scans (user_id, scan_type, scanned_by)
		VALUES ($1, $2, $3)
		RETURNING id, scanned_at, created_at
	`

	err := s.db.QueryRowContext(ctx, query, scan.UserID, scan.ScanType, scan.ScannedBy).
		Scan(&scan.ID, &scan.ScannedAt, &scan.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrConflict
		}
		return err
	}

	return nil
}

func (s *ScansStore) GetByUserID(ctx context.Context, userID string) ([]Scan, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, user_id, scan_type, scanned_by, scanned_at, created_at
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
		if err := rows.Scan(&scan.ID, &scan.UserID, &scan.ScanType, &scan.ScannedBy, &scan.ScannedAt, &scan.CreatedAt); err != nil {
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

	query := `
		SELECT scan_type, COUNT(*) as count
		FROM scans
		GROUP BY scan_type
		ORDER BY scan_type
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []ScanStat
	for rows.Next() {
		var stat ScanStat
		if err := rows.Scan(&stat.ScanType, &stat.Count); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	if stats == nil {
		stats = []ScanStat{}
	}

	return stats, rows.Err()
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
