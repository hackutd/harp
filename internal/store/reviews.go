package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// ReviewVote represents the possible vote values for an application review
type ReviewVote string

const (
	ReviewVoteAccept   ReviewVote = "accept"
	ReviewVoteReject   ReviewVote = "reject"
	ReviewVoteWaitlist ReviewVote = "waitlist"
)

// ApplicationReview represents a single admin review of an application
type ApplicationReview struct {
	ID            string      `json:"id"`
	ApplicationID string      `json:"application_id"`
	AdminID       string      `json:"admin_id"`
	Vote          *ReviewVote `json:"vote"`
	Notes         *string     `json:"notes"`
	AssignedAt    time.Time   `json:"assigned_at"`
	ReviewedAt    *time.Time  `json:"reviewed_at"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// ApplicationReviewsStore handles database operations for application reviews
type ApplicationReviewsStore struct {
	db *sql.DB
}

// SubmitVote records an admin's vote on an assigned review
func (s *ApplicationReviewsStore) SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, notes *string) (*ApplicationReview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE application_reviews
		SET vote = $3, notes = $4, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND admin_id = $2
		RETURNING id, application_id, admin_id, vote, notes, assigned_at, reviewed_at, created_at, updated_at
	`

	var review ApplicationReview
	err := s.db.QueryRowContext(ctx, query, reviewID, adminID, vote, notes).Scan(
		&review.ID, &review.ApplicationID, &review.AdminID,
		&review.Vote, &review.Notes,
		&review.AssignedAt, &review.ReviewedAt,
		&review.CreatedAt, &review.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &review, nil
}

// GetPendingByAdminID returns all reviews assigned to an admin that haven't been voted on yet
func (s *ApplicationReviewsStore) GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, application_id, admin_id, vote, notes, assigned_at, reviewed_at, created_at, updated_at
		FROM application_reviews
		WHERE admin_id = $1 AND vote IS NULL
		ORDER BY assigned_at ASC
	`

	rows, err := s.db.QueryContext(ctx, query, adminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews := []ApplicationReview{}
	for rows.Next() {
		var review ApplicationReview
		if err := rows.Scan(
			&review.ID, &review.ApplicationID, &review.AdminID,
			&review.Vote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
		); err != nil {
			return nil, err
		}
		reviews = append(reviews, review)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reviews, nil
}

// GetByApplicationID returns all reviews for a specific application
func (s *ApplicationReviewsStore) GetByApplicationID(ctx context.Context, applicationID string) ([]ApplicationReview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, application_id, admin_id, vote, notes, assigned_at, reviewed_at, created_at, updated_at
		FROM application_reviews
		WHERE application_id = $1
		ORDER BY assigned_at ASC
	`

	rows, err := s.db.QueryContext(ctx, query, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews := []ApplicationReview{}
	for rows.Next() {
		var review ApplicationReview
		if err := rows.Scan(
			&review.ID, &review.ApplicationID, &review.AdminID,
			&review.Vote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
		); err != nil {
			return nil, err
		}
		reviews = append(reviews, review)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reviews, nil
}
