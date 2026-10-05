package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type HackerLink struct {
	ID           string    `json:"id"`
	Label        string    `json:"label"`
	URL          string    `json:"url"`
	Icon         string    `json:"icon"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type HackerLinksStore struct {
	db *sql.DB
}

func (s *HackerLinksStore) List(ctx context.Context) ([]HackerLink, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, label, url, icon, display_order, created_at, updated_at
		FROM hacker_links
		ORDER BY display_order ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []HackerLink
	for rows.Next() {
		var link HackerLink
		if err := rows.Scan(
			&link.ID, &link.Label, &link.URL, &link.Icon, &link.DisplayOrder,
			&link.CreatedAt, &link.UpdatedAt,
		); err != nil {
			return nil, err
		}
		links = append(links, link)
	}

	if links == nil {
		links = []HackerLink{}
	}

	return links, rows.Err()
}

func (s *HackerLinksStore) Create(ctx context.Context, link *HackerLink) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO hacker_links (label, url, icon, display_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		link.Label, link.URL, link.Icon, link.DisplayOrder,
	).Scan(&link.ID, &link.CreatedAt, &link.UpdatedAt)
}

func (s *HackerLinksStore) Update(ctx context.Context, link *HackerLink) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE hacker_links
		SET label = $1, url = $2, icon = $3, display_order = $4
		WHERE id = $5
		RETURNING created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		link.Label, link.URL, link.Icon, link.DisplayOrder, link.ID,
	).Scan(&link.CreatedAt, &link.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *HackerLinksStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM hacker_links WHERE id = $1`

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
