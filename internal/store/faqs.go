package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type FAQ struct {
	ID           string    `json:"id"`
	Question     string    `json:"question"`
	Answer       string    `json:"answer"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FAQsStore struct {
	db *sql.DB
}

func (s *FAQsStore) List(ctx context.Context) ([]FAQ, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, question, answer, display_order, created_at, updated_at
		FROM faqs
		ORDER BY display_order ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var faqs []FAQ
	for rows.Next() {
		var faq FAQ
		if err := rows.Scan(
			&faq.ID, &faq.Question, &faq.Answer, &faq.DisplayOrder,
			&faq.CreatedAt, &faq.UpdatedAt,
		); err != nil {
			return nil, err
		}
		faqs = append(faqs, faq)
	}

	if faqs == nil {
		faqs = []FAQ{}
	}

	return faqs, rows.Err()
}

func (s *FAQsStore) Create(ctx context.Context, faq *FAQ) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO faqs (question, answer, display_order)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		faq.Question, faq.Answer, faq.DisplayOrder,
	).Scan(&faq.ID, &faq.CreatedAt, &faq.UpdatedAt)
}

func (s *FAQsStore) Update(ctx context.Context, faq *FAQ) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE faqs
		SET question = $1, answer = $2, display_order = $3
		WHERE id = $4
		RETURNING created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		faq.Question, faq.Answer, faq.DisplayOrder, faq.ID,
	).Scan(&faq.CreatedAt, &faq.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *FAQsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM faqs WHERE id = $1`

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
