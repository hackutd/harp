package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Sponsor struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Tier            string    `json:"tier"`
	LogoData        string    `json:"logo_data"`
	LogoContentType string    `json:"logo_content_type"`
	WebsiteURL      string    `json:"website_url"`
	Description     string    `json:"description"`
	DisplayOrder    int       `json:"display_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type SponsorsStore struct {
	db *sql.DB
}

func (s *SponsorsStore) List(ctx context.Context) ([]Sponsor, error) {

	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, name, tier, logo_data, logo_content_type, website_url, description, display_order, created_at, updated_at
		FROM sponsors
		ORDER BY display_order ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sponsors []Sponsor
	for rows.Next() {
		var sponsor Sponsor
		if err := rows.Scan(
			&sponsor.ID, &sponsor.Name, &sponsor.Tier, &sponsor.LogoData, &sponsor.LogoContentType,
			&sponsor.WebsiteURL, &sponsor.Description, &sponsor.DisplayOrder,
			&sponsor.CreatedAt, &sponsor.UpdatedAt,
		); err != nil {
			return nil, err
		}
		sponsors = append(sponsors, sponsor)
	}

	if sponsors == nil {
		sponsors = []Sponsor{}
	}

	return sponsors, rows.Err()
}

func (s *SponsorsStore) Create(ctx context.Context, sponsor *Sponsor) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO sponsors (name, tier, website_url, description, display_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		sponsor.Name, sponsor.Tier, sponsor.WebsiteURL, sponsor.Description, sponsor.DisplayOrder,
	).Scan(&sponsor.ID, &sponsor.CreatedAt, &sponsor.UpdatedAt)
}

func (s *SponsorsStore) Update(ctx context.Context, sponsor *Sponsor) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE sponsors
		SET name = $1, tier = $2, website_url = $3, description = $4, display_order = $5
		WHERE id = $6
		RETURNING logo_data, logo_content_type, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		sponsor.Name, sponsor.Tier, sponsor.WebsiteURL, sponsor.Description, sponsor.DisplayOrder, sponsor.ID,
	).Scan(&sponsor.LogoData, &sponsor.LogoContentType, &sponsor.CreatedAt, &sponsor.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *SponsorsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM sponsors WHERE id = $1`

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

func (s *SponsorsStore) GetByID(ctx context.Context, id string) (*Sponsor, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, name, tier, logo_data, logo_content_type, website_url, description, display_order, created_at, updated_at
		FROM sponsors
		WHERE id = $1
	`

	var sponsor Sponsor
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&sponsor.ID, &sponsor.Name, &sponsor.Tier, &sponsor.LogoData, &sponsor.LogoContentType,
		&sponsor.WebsiteURL, &sponsor.Description, &sponsor.DisplayOrder,
		&sponsor.CreatedAt, &sponsor.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &sponsor, nil
}

func (s *SponsorsStore) UpdateLogo(ctx context.Context, id string, logoData string, logoContentType string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `UPDATE sponsors SET logo_data = $1, logo_content_type = $2 WHERE id = $3`

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
