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

// BatchAssignmentResult contains stats about a batch assignment operation
type BatchAssignmentResult struct {
	ReviewsCreated int `json:"reviews_created"`
}

// BatchAssign assigns reviews to admins for submitted applications needing more reviews.
// Uses workload balancing — admins with fewer pending reviews are assigned first.
func (s *ApplicationReviewsStore) BatchAssign(ctx context.Context, reviewsPerApp int) (*BatchAssignmentResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get admins sorted by pending workload (fewest pending first)
	adminsQuery := `
		SELECT u.id
		FROM users u
		LEFT JOIN application_reviews ar ON u.id = ar.admin_id AND ar.vote IS NULL
		WHERE u.role IN ('admin', 'super_admin')
		GROUP BY u.id, u.created_at
		ORDER BY COUNT(ar.id) ASC, u.created_at ASC
	`

	adminRows, err := tx.QueryContext(ctx, adminsQuery)
	if err != nil {
		return nil, err
	}
	defer adminRows.Close()

	var adminIDs []string
	for adminRows.Next() {
		var id string
		if err := adminRows.Scan(&id); err != nil {
			return nil, err
		}
		adminIDs = append(adminIDs, id)
	}
	if err := adminRows.Err(); err != nil {
		return nil, err
	}

	if len(adminIDs) == 0 {
		return &BatchAssignmentResult{}, nil
	}

	// Get submitted applications needing reviews
	appsQuery := `
		SELECT id, user_id, reviews_assigned
		FROM applications
		WHERE status = 'submitted' AND reviews_assigned < $1
		ORDER BY reviews_assigned ASC, submitted_at ASC
		FOR UPDATE
	`

	appRows, err := tx.QueryContext(ctx, appsQuery, reviewsPerApp)
	if err != nil {
		return nil, err
	}
	defer appRows.Close()

	type appInfo struct {
		ID              string
		UserID          string
		ReviewsAssigned int
	}

	var apps []appInfo
	for appRows.Next() {
		var a appInfo
		if err := appRows.Scan(&a.ID, &a.UserID, &a.ReviewsAssigned); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}
	if err := appRows.Err(); err != nil {
		return nil, err
	}

	if len(apps) == 0 {
		return &BatchAssignmentResult{}, nil
	}

	// Round-robin assignment with workload balancing
	insertQuery := `
		INSERT INTO application_reviews (application_id, admin_id)
		VALUES ($1, $2)
		ON CONFLICT (application_id, admin_id) DO NOTHING
	`

	reviewsCreated := 0
	adminIndex := 0

	for _, app := range apps {
		needed := reviewsPerApp - app.ReviewsAssigned

		for i := 0; i < needed; i++ {
			for attempts := 0; attempts < len(adminIDs); attempts++ {
				adminID := adminIDs[adminIndex]
				adminIndex = (adminIndex + 1) % len(adminIDs)

				// Skip self-review
				if adminID == app.UserID {
					continue
				}

				result, err := tx.ExecContext(ctx, insertQuery, app.ID, adminID)
				if err != nil {
					return nil, err
				}

				rowsAffected, err := result.RowsAffected()
				if err != nil {
					return nil, err
				}

				if rowsAffected > 0 {
					reviewsCreated++
				}
				break
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &BatchAssignmentResult{
		ReviewsCreated: reviewsCreated,
	}, nil
}

// AssignNextForAdmin finds and assigns the next application needing review to the given admin.
// Returns ErrNotFound if no applications need review.
func (s *ApplicationReviewsStore) AssignNextForAdmin(ctx context.Context, adminID string, reviewsPerApp int) (*ApplicationReview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Find next application: fewest reviews first, oldest submitted first,
	// not already assigned to this admin, not the admin's own application
	findQuery := `
		SELECT id FROM applications
		WHERE status = 'submitted'
		  AND reviews_assigned < $1
		  AND user_id != $2
		  AND NOT EXISTS (
		      SELECT 1 FROM application_reviews ar
		      WHERE ar.application_id = applications.id AND ar.admin_id = $2
		  )
		ORDER BY reviews_assigned ASC, submitted_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`

	var applicationID string
	err = tx.QueryRowContext(ctx, findQuery, reviewsPerApp, adminID).Scan(&applicationID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Create the assignment
	insertQuery := `
		INSERT INTO application_reviews (application_id, admin_id)
		VALUES ($1, $2)
		ON CONFLICT (application_id, admin_id) DO NOTHING
		RETURNING id, application_id, admin_id, vote, notes, assigned_at, reviewed_at, created_at, updated_at
	`

	var review ApplicationReview
	err = tx.QueryRowContext(ctx, insertQuery, applicationID, adminID).Scan(
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

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &review, nil
}
