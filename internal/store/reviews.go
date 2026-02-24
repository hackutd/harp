package store

import (
	"context"
	"database/sql"
	"encoding/json"
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

// ApplicationReviewWithDetails includes application info for display in the review list
type ApplicationReviewWithDetails struct {
	ApplicationReview
	// Application fields
	FirstName               *string `json:"first_name"`
	LastName                *string `json:"last_name"`
	Email                   string  `json:"email"`
	Age                     *int16  `json:"age"`
	University              *string `json:"university"`
	Major                   *string `json:"major"`
	CountryOfResidence      *string `json:"country_of_residence"`
	HackathonsAttendedCount *int16  `json:"hackathons_attended_count"`
}

// ReviewNote represents a note from an admin review (without vote information)
type ReviewNote struct {
	AdminID    string    `json:"admin_id"`
	AdminEmail string    `json:"admin_email"`
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
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

// GetPendingByAdminID returns all reviews assigned to an admin that haven't been voted on yet,
// including application details for display
func (s *ApplicationReviewsStore) GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT
			ar.id, ar.application_id, ar.admin_id, ar.vote, ar.notes,
			ar.assigned_at, ar.reviewed_at, ar.created_at, ar.updated_at,
			a.first_name, a.last_name, u.email, a.age,
			a.university, a.major, a.country_of_residence, a.hackathons_attended_count
		FROM application_reviews ar
		JOIN applications a ON ar.application_id = a.id
		JOIN users u ON a.user_id = u.id
		WHERE ar.admin_id = $1 AND ar.vote IS NULL
		ORDER BY ar.assigned_at ASC
	`

	rows, err := s.db.QueryContext(ctx, query, adminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews := []ApplicationReviewWithDetails{}
	for rows.Next() {
		var review ApplicationReviewWithDetails
		if err := rows.Scan(
			&review.ID, &review.ApplicationID, &review.AdminID,
			&review.Vote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
			&review.FirstName, &review.LastName, &review.Email, &review.Age,
			&review.University, &review.Major, &review.CountryOfResidence, &review.HackathonsAttendedCount,
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

// GetCompletedByAdminID returns all reviews completed by an admin (vote is not null),
// including application details for display
func (s *ApplicationReviewsStore) GetCompletedByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT
			ar.id, ar.application_id, ar.admin_id, ar.vote, ar.notes,
			ar.assigned_at, ar.reviewed_at, ar.created_at, ar.updated_at,
			a.first_name, a.last_name, u.email, a.age,
			a.university, a.major, a.country_of_residence, a.hackathons_attended_count
		FROM application_reviews ar
		JOIN applications a ON ar.application_id = a.id
		JOIN users u ON a.user_id = u.id
		WHERE ar.admin_id = $1 AND ar.vote IS NOT NULL
		ORDER BY ar.reviewed_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, adminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews := []ApplicationReviewWithDetails{}
	for rows.Next() {
		var review ApplicationReviewWithDetails
		if err := rows.Scan(
			&review.ID, &review.ApplicationID, &review.AdminID,
			&review.Vote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
			&review.FirstName, &review.LastName, &review.Email, &review.Age,
			&review.University, &review.Major, &review.CountryOfResidence, &review.HackathonsAttendedCount,
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

// GetNotesByApplicationID returns all non-empty notes for a specific application (without votes)
func (s *ApplicationReviewsStore) GetNotesByApplicationID(ctx context.Context, applicationID string) ([]ReviewNote, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT ar.admin_id, u.email, ar.notes, ar.created_at
		FROM application_reviews ar
		JOIN users u ON ar.admin_id = u.id
		WHERE ar.application_id = $1 AND ar.notes IS NOT NULL AND ar.notes != ''
		ORDER BY ar.created_at ASC
	`

	rows, err := s.db.QueryContext(ctx, query, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := []ReviewNote{}
	for rows.Next() {
		var note ReviewNote
		if err := rows.Scan(
			&note.AdminID, &note.AdminEmail, &note.Notes, &note.CreatedAt,
		); err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return notes, nil
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

	// First, ensure all admins/super_admins exist in the review assignment setting.
	// This acts as a backfill for any admins that were created before this setting existed
	// or were added to the database manually.
	backfillAdminsQuery := `
		SELECT u.id, u.role
		FROM users u
		WHERE u.role IN ('admin', 'super_admin')
	`
	adminRows, err := tx.QueryContext(ctx, backfillAdminsQuery)
	if err != nil {
		return nil, err
	}

	var allAdminIDs []string
	adminRoles := make(map[string]UserRole)
	for adminRows.Next() {
		var id string
		var role UserRole
		if err := adminRows.Scan(&id, &role); err != nil {
			adminRows.Close()
			return nil, err
		}
		allAdminIDs = append(allAdminIDs, id)
		adminRoles[id] = role
	}
	adminRows.Close()
	if err := adminRows.Err(); err != nil {
		return nil, err
	}

	type reviewAssignmentEntry struct {
		ID      string `json:"id"`
		Enabled bool   `json:"enabled"`
	}
	var entries []reviewAssignmentEntry

	selectSettingQuery := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`
	var value []byte
	err = tx.QueryRowContext(ctx, selectSettingQuery, SettingsKeyReviewAssignmentEnabled).Scan(&value)

	isNewSetting := false
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		isNewSetting = true
		entries = []reviewAssignmentEntry{}
	} else {
		if jerr := json.Unmarshal(value, &entries); jerr != nil {
			var ids []string
			if jerr2 := json.Unmarshal(value, &ids); jerr2 == nil {
				entries = []reviewAssignmentEntry{}
				for _, id := range ids {
					entries = append(entries, reviewAssignmentEntry{ID: id, Enabled: true})
				}
			} else {
				entries = []reviewAssignmentEntry{}
			}
		}
	}

	existingAdminMap := make(map[string]bool)
	for _, entry := range entries {
		existingAdminMap[entry.ID] = true
	}

	changesMade := false
	for _, adminID := range allAdminIDs {
		if _, exists := existingAdminMap[adminID]; !exists {
			defaultEnabled := adminRoles[adminID] == RoleAdmin
			entries = append(entries, reviewAssignmentEntry{ID: adminID, Enabled: defaultEnabled})
			changesMade = true
		}
	}

	if changesMade || isNewSetting {
		jsonValue, err := json.Marshal(entries)
		if err != nil {
			return nil, err
		}

		upsertQuery := `
			INSERT INTO settings (key, value)
			VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`
		if _, err := tx.ExecContext(ctx, upsertQuery, SettingsKeyReviewAssignmentEnabled, string(jsonValue)); err != nil {
			return nil, err
		}
	}

	// Remove pending assignments owned by admins who are not listed in the
	// review assignment setting so those applications can be redistributed
	// to enabled admins. The setting is stored in `settings` with key
	// 'review_assignment_enabled' as a JSONB array of objects {"id","enabled"}.
	cleanupQuery := `
		DELETE FROM application_reviews ar
		WHERE ar.vote IS NULL
		AND EXISTS (
			SELECT 1
			FROM settings s
			CROSS JOIN jsonb_array_elements(s.value) AS elem
			WHERE s.key = 'review_assignment_enabled'
			AND elem->>'id' = ar.admin_id::text
			AND (elem->'enabled')::boolean = false
		);
		`

	if _, err := tx.ExecContext(ctx, cleanupQuery); err != nil {
		return nil, err
	}

	// Get admins sorted by pending workload (fewest pending first)
	adminsQuery := `
		SELECT u.id
		FROM users u
		LEFT JOIN application_reviews ar 
			ON u.id = ar.admin_id AND ar.vote IS NULL
		LEFT JOIN settings s 
			ON s.key = 'review_assignment_enabled'
		WHERE u.role IN ('admin', 'super_admin')
		AND NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements(s.value) AS elem
			WHERE elem->>'id' = u.id::text
				AND (elem->'enabled')::boolean = false
		)
		GROUP BY u.id, u.created_at
		ORDER BY COUNT(ar.id) ASC, u.created_at ASC;
	`

	adminRows, err = tx.QueryContext(ctx, adminsQuery)
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
