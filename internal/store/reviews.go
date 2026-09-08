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
	TravelVote    *bool       `json:"travel_vote"`
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
	FirstName          *string      `json:"first_name"`
	LastName           *string      `json:"last_name"`
	Email              string       `json:"email"`
	Age                *int16       `json:"age"`
	University         *string      `json:"university"`
	Major              *string      `json:"major"`
	CountryOfResidence *string      `json:"country_of_residence"`
	HackathonsAttended *int16       `json:"hackathons_attended"`
	TravelStatus       TravelStatus `json:"travel_status"`
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

// ErrVoteNotApplied means the vote UPDATE matched no row: either the review
// does not exist for this admin, or travelVote disagreed with the application's
// travel status. The two are indistinguishable from the statement itself, so a
// caller that needs to tell them apart follows up with
// GetTravelStatusByReviewID -- only on this error path, never on a good vote.
var ErrVoteNotApplied = errors.New("vote not applied")

// SubmitVote records an admin's vote on an assigned review. travelVote is the
// admin's yes/no travel reimbursement recommendation; nil when the applicant
// did not request travel.
//
// The join onto applications makes the travel agreement part of the write
// itself rather than a separate read beforehand, which halves the queries on
// the review path and closes the window where travel_status could change
// between the check and the update.
func (s *ApplicationReviewsStore) SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, travelVote *bool, notes *string) (*ApplicationReview, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE application_reviews ar
		SET vote = $3, travel_vote = $4, notes = $5, reviewed_at = NOW(), updated_at = NOW()
		FROM applications a
		WHERE ar.id = $1 AND ar.admin_id = $2 AND a.id = ar.application_id
		  AND ((a.travel_status = 'not_requested') = ($4::boolean IS NULL))
		RETURNING ar.id, ar.application_id, ar.admin_id, ar.vote, ar.travel_vote, ar.notes,
		          ar.assigned_at, ar.reviewed_at, ar.created_at, ar.updated_at
	`

	var review ApplicationReview
	err := s.db.QueryRowContext(ctx, query, reviewID, adminID, vote, travelVote, notes).Scan(
		&review.ID, &review.ApplicationID, &review.AdminID,
		&review.Vote, &review.TravelVote, &review.Notes,
		&review.AssignedAt, &review.ReviewedAt,
		&review.CreatedAt, &review.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVoteNotApplied
		}
		return nil, err
	}

	return &review, nil
}

// GetTravelStatusByReviewID returns the travel status of the application tied
// to a review, scoped to the assigned admin so it doubles as an ownership check.
func (s *ApplicationReviewsStore) GetTravelStatusByReviewID(ctx context.Context, reviewID string, adminID string) (TravelStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT a.travel_status
		FROM application_reviews ar
		JOIN applications a ON ar.application_id = a.id
		WHERE ar.id = $1 AND ar.admin_id = $2
	`

	var status TravelStatus
	err := s.db.QueryRowContext(ctx, query, reviewID, adminID).Scan(&status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}

	return status, nil
}

// GetPendingByAdminID returns all reviews assigned to an admin that haven't been voted on yet,
// including application details for display
func (s *ApplicationReviewsStore) GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT
			ar.id, ar.application_id, ar.admin_id, ar.vote, ar.travel_vote, ar.notes,
			ar.assigned_at, ar.reviewed_at, ar.created_at, ar.updated_at,
			a.responses->>'first_name', a.responses->>'last_name', u.email,
			NULLIF(a.responses->>'age', '')::smallint,
			a.responses->>'university', a.responses->>'major',
			a.responses->>'country_of_residence',
			NULLIF(a.responses->>'hackathons_attended', '')::smallint,
			a.travel_status
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
			&review.Vote, &review.TravelVote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
			&review.FirstName, &review.LastName, &review.Email, &review.Age,
			&review.University, &review.Major, &review.CountryOfResidence, &review.HackathonsAttended,
			&review.TravelStatus,
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
			ar.id, ar.application_id, ar.admin_id, ar.vote, ar.travel_vote, ar.notes,
			ar.assigned_at, ar.reviewed_at, ar.created_at, ar.updated_at,
			a.responses->>'first_name', a.responses->>'last_name', u.email,
			NULLIF(a.responses->>'age', '')::smallint,
			a.responses->>'university', a.responses->>'major',
			a.responses->>'country_of_residence',
			NULLIF(a.responses->>'hackathons_attended', '')::smallint,
			a.travel_status
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
			&review.Vote, &review.TravelVote, &review.Notes,
			&review.AssignedAt, &review.ReviewedAt,
			&review.CreatedAt, &review.UpdatedAt,
			&review.FirstName, &review.LastName, &review.Email, &review.Age,
			&review.University, &review.Major, &review.CountryOfResidence, &review.HackathonsAttended,
			&review.TravelStatus,
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

// BatchAssignmentResult reports the committed changes and any remaining shortage
// among the submitted applications considered by this run.
type BatchAssignmentResult struct {
	ReviewsCreated          int `json:"reviews_created"`
	ReviewsRemoved          int `json:"reviews_removed"`
	ReviewsPerApplication   int `json:"reviews_per_application"`
	ApplicationsBelowTarget int `json:"applications_below_target"`
	ReviewsUnfilled         int `json:"reviews_unfilled"`
}

// BatchAssign recovers inaccessible pending reviews and fills submitted
// applications' assignment targets with distinct, currently eligible reviewers.
func (s *ApplicationReviewsStore) BatchAssign(ctx context.Context, reviewsPerApp int) (*BatchAssignmentResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Serialize batches even when this setting has not been created yet.
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO settings (key, value) VALUES ($1, '[]'::jsonb)
		ON CONFLICT (key) DO NOTHING
	`, SettingsKeyReviewAssignmentToggle); err != nil {
		return nil, err
	}
	var value []byte
	if err := tx.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = $1 FOR UPDATE`,
		SettingsKeyReviewAssignmentToggle).Scan(&value); err != nil {
		return nil, err
	}
	entries, err := parseReviewAssignmentEntries(value)
	if err != nil || entries == nil {
		// Match the toggle setting's existing default-enabled behavior.
		entries = []ReviewAssignmentEntry{}
	}
	disabledIDs := []string{}
	listed := make(map[string]bool, len(entries))
	for _, entry := range entries {
		listed[entry.ID] = true
		if !entry.Enabled {
			disabledIDs = append(disabledIDs, entry.ID)
		}
	}

	result := &BatchAssignmentResult{ReviewsPerApplication: reviewsPerApp}
	removed, err := tx.ExecContext(ctx, `
		DELETE FROM application_reviews ar
		WHERE ar.vote IS NULL AND (
			ar.admin_id::text = ANY($1::text[]) OR NOT EXISTS (
				SELECT 1 FROM users u
				WHERE u.id = ar.admin_id AND u.role IN ('admin', 'super_admin')
			)
		)
	`, disabledIDs)
	if err != nil {
		return nil, err
	}
	n, err := removed.RowsAffected()
	if err != nil {
		return nil, err
	}
	result.ReviewsRemoved = int(n)

	// Read workloads after cleanup. Creation time and ID provide stable ties.
	adminRows, err := tx.QueryContext(ctx, `
		SELECT u.id, u.role, COUNT(ar.id), NOT (u.id::text = ANY($1::text[]))
		FROM users u
		LEFT JOIN application_reviews ar ON ar.admin_id = u.id AND ar.vote IS NULL
		WHERE u.role IN ('admin', 'super_admin')
		GROUP BY u.id
		ORDER BY u.created_at, u.id
	`, disabledIDs)
	if err != nil {
		return nil, err
	}
	defer adminRows.Close()
	type reviewer struct {
		ID      string
		Pending int
	}
	var admins []reviewer
	for adminRows.Next() {
		var admin reviewer
		var role UserRole
		var enabled bool
		if err := adminRows.Scan(&admin.ID, &role, &admin.Pending, &enabled); err != nil {
			return nil, err
		}
		if role == RoleSuperAdmin && !listed[admin.ID] {
			entries = append(entries, ReviewAssignmentEntry{ID: admin.ID, Enabled: true})
		}
		if enabled {
			admins = append(admins, admin)
		}
	}
	if err := adminRows.Err(); err != nil {
		return nil, err
	}
	adminRows.Close()

	// Normalize legacy settings and retain the super-admin backfill.
	encoded, err := json.Marshal(entries)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`,
		SettingsKeyReviewAssignmentToggle, string(encoded)); err != nil {
		return nil, err
	}

	appRows, err := tx.QueryContext(ctx, `
		SELECT id, user_id, reviews_assigned FROM applications
		WHERE status = 'submitted' AND reviews_assigned < $1
		ORDER BY reviews_assigned, submitted_at, id
		FOR UPDATE
	`, reviewsPerApp)
	if err != nil {
		return nil, err
	}
	defer appRows.Close()
	type application struct {
		ID       string
		UserID   string
		Assigned int
	}
	var apps []application
	appIDs := []string{}
	for appRows.Next() {
		var app application
		if err := appRows.Scan(&app.ID, &app.UserID, &app.Assigned); err != nil {
			return nil, err
		}
		apps = append(apps, app)
		appIDs = append(appIDs, app.ID)
	}
	if err := appRows.Err(); err != nil {
		return nil, err
	}
	appRows.Close()

	// Both pending and completed reviews reserve their reviewer/application pair.
	pairs := make(map[string]map[string]bool, len(apps))
	if len(apps) > 0 {
		rows, err := tx.QueryContext(ctx, `
			SELECT application_id, admin_id FROM application_reviews
			WHERE application_id = ANY($1::uuid[])
		`, appIDs)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var appID, adminID string
			if err := rows.Scan(&appID, &adminID); err != nil {
				return nil, err
			}
			if pairs[appID] == nil {
				pairs[appID] = make(map[string]bool)
			}
			pairs[appID][adminID] = true
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		rows.Close()
	}

	var pairAppIDs, pairAdminIDs []string
	for _, app := range apps {
		if pairs[app.ID] == nil {
			pairs[app.ID] = make(map[string]bool)
		}
		for range reviewsPerApp - app.Assigned {
			best := -1
			for i, admin := range admins {
				if admin.ID == app.UserID || pairs[app.ID][admin.ID] {
					continue
				}
				if best == -1 || admin.Pending < admins[best].Pending {
					best = i
				}
			}
			if best == -1 {
				break
			}
			admin := &admins[best]
			pairs[app.ID][admin.ID] = true
			admin.Pending++
			pairAppIDs = append(pairAppIDs, app.ID)
			pairAdminIDs = append(pairAdminIDs, admin.ID)
		}
	}
	if len(pairAppIDs) > 0 {
		inserted, err := tx.ExecContext(ctx, `
			INSERT INTO application_reviews (application_id, admin_id)
			SELECT * FROM unnest($1::uuid[], $2::uuid[])
			ON CONFLICT (application_id, admin_id) DO NOTHING
		`, pairAppIDs, pairAdminIDs)
		if err != nil {
			return nil, err
		}
		n, err := inserted.RowsAffected()
		if err != nil {
			return nil, err
		}
		result.ReviewsCreated = int(n)
	}

	// Use actual counters after insertion, never the number of attempted pairs.
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM($2 - reviews_assigned), 0)
		FROM applications
		WHERE id = ANY($1::uuid[]) AND reviews_assigned < $2
	`, appIDs, reviewsPerApp).Scan(&result.ApplicationsBelowTarget, &result.ReviewsUnfilled); err != nil {
		return nil, err
	}
	// Cleanup and backfill must also commit when no new assignments are possible.
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

// SetAIPercent sets the AI-generated percent on an application, only if the admin is assigned to it and it hasn't been set yet.
func (s *ApplicationReviewsStore) SetAIPercent(ctx context.Context, applicationID string, adminID string, percent int16) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET ai_percent = $3
		WHERE id = $1
		  AND ai_percent IS NULL
		  AND EXISTS (
		      SELECT 1 FROM application_reviews
		      WHERE application_id = $1
					AND admin_id = $2
		  )
	`

	result, err := s.db.ExecContext(ctx, query, applicationID, adminID, percent)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
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
		RETURNING id, application_id, admin_id, vote, travel_vote, notes, assigned_at, reviewed_at, created_at, updated_at
	`

	var review ApplicationReview
	err = tx.QueryRowContext(ctx, insertQuery, applicationID, adminID).Scan(
		&review.ID, &review.ApplicationID, &review.AdminID,
		&review.Vote, &review.TravelVote, &review.Notes,
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
