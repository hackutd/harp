package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// TrackPrize is one ranked prize on a challenge track, e.g. {"1st", "$300 Amazon gift card"}.
type TrackPrize struct {
	Place string `json:"place"`
	Prize string `json:"prize"`
}

// TrackPrizes implements sql.Scanner and driver.Valuer for the prizes JSONB column.
type TrackPrizes []TrackPrize

func (p *TrackPrizes) Scan(src any) error {
	if src == nil {
		*p = TrackPrizes{}
		return nil
	}

	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("TrackPrizes.Scan: unsupported type %T", src)
	}

	if len(b) == 0 {
		*p = TrackPrizes{}
		return nil
	}

	var prizes []TrackPrize
	if err := json.Unmarshal(b, &prizes); err != nil {
		return err
	}
	if prizes == nil {
		prizes = []TrackPrize{}
	}
	*p = prizes
	return nil
}

func (p TrackPrizes) Value() (driver.Value, error) {
	if p == nil {
		// The column is NOT NULL, so an unset slice still has to serialize.
		return []byte("[]"), nil
	}
	return json.Marshal([]TrackPrize(p))
}

type Track struct {
	ID              string      `json:"id"`
	Title           string      `json:"title"`
	SponsorName     string      `json:"sponsor_name"`
	Description     string      `json:"description"`
	Prizes          TrackPrizes `json:"prizes"`
	LogoData        string      `json:"logo_data"`
	LogoContentType string      `json:"logo_content_type"`
	DisplayOrder    int         `json:"display_order"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type TracksStore struct {
	db *sql.DB
}

func (s *TracksStore) List(ctx context.Context) ([]Track, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, title, sponsor_name, description, prizes, logo_data, logo_content_type,
		       display_order, created_at, updated_at
		FROM tracks
		ORDER BY display_order ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tracks []Track
	for rows.Next() {
		var track Track
		if err := rows.Scan(
			&track.ID, &track.Title, &track.SponsorName, &track.Description, &track.Prizes,
			&track.LogoData, &track.LogoContentType, &track.DisplayOrder,
			&track.CreatedAt, &track.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tracks = append(tracks, track)
	}

	if tracks == nil {
		tracks = []Track{}
	}

	return tracks, rows.Err()
}

func (s *TracksStore) GetByID(ctx context.Context, id string) (*Track, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, title, sponsor_name, description, prizes, logo_data, logo_content_type,
		       display_order, created_at, updated_at
		FROM tracks
		WHERE id = $1
	`

	var track Track
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&track.ID, &track.Title, &track.SponsorName, &track.Description, &track.Prizes,
		&track.LogoData, &track.LogoContentType, &track.DisplayOrder,
		&track.CreatedAt, &track.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &track, nil
}

func (s *TracksStore) Create(ctx context.Context, track *Track) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO tracks (title, sponsor_name, description, prizes, display_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		track.Title, track.SponsorName, track.Description, track.Prizes, track.DisplayOrder,
	).Scan(&track.ID, &track.CreatedAt, &track.UpdatedAt)
}

func (s *TracksStore) Update(ctx context.Context, track *Track) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// The logo columns are read back but never written here, so editing a track
	// can't blank a logo that was uploaded through UpdateLogo.
	query := `
		UPDATE tracks
		SET title = $1, sponsor_name = $2, description = $3, prizes = $4, display_order = $5
		WHERE id = $6
		RETURNING logo_data, logo_content_type, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		track.Title, track.SponsorName, track.Description, track.Prizes, track.DisplayOrder, track.ID,
	).Scan(&track.LogoData, &track.LogoContentType, &track.CreatedAt, &track.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *TracksStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM tracks WHERE id = $1`

	result, err := s.db.ExecContext(ctx, query, id)
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

func (s *TracksStore) UpdateLogo(ctx context.Context, id string, logoData string, logoContentType string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `UPDATE tracks SET logo_data = $1, logo_content_type = $2 WHERE id = $3`

	result, err := s.db.ExecContext(ctx, query, logoData, logoContentType, id)
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
