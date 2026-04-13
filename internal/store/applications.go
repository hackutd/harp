package store

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type ApplicationStatus string

const (
	StatusDraft      ApplicationStatus = "draft"
	StatusSubmitted  ApplicationStatus = "submitted"
	StatusAccepted   ApplicationStatus = "accepted"
	StatusRejected   ApplicationStatus = "rejected"
	StatusWaitlisted ApplicationStatus = "waitlisted"
)

// PaginationDirection for bidirectional cursor traversal
type PaginationDirection string

const (
	DirectionForward  PaginationDirection = "forward"
	DirectionBackward PaginationDirection = "backward"
)

// ApplicationSortBy defines the column to sort the application list by
type ApplicationSortBy string

const (
	SortByCreatedAt     ApplicationSortBy = "created_at"
	SortByAcceptVotes   ApplicationSortBy = "accept_votes"
	SortByRejectVotes   ApplicationSortBy = "reject_votes"
	SortByWaitlistVotes ApplicationSortBy = "waitlist_votes"
)

// ApplicationCursor represents pagination cursor
type ApplicationCursor struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
	SortVal   *int      `json:"v,omitempty"` // used for vote-column sorting
}

// ApplicationListFilters for query filtering
type ApplicationListFilters struct {
	Status *ApplicationStatus
	Search *string
	SortBy ApplicationSortBy
}

// ApplicationListItem is a lightweight view for admin listing
type ApplicationListItem struct {
	ID                      string            `json:"id"`
	UserID                  string            `json:"user_id"`
	Email                   string            `json:"email"`
	Status                  ApplicationStatus `json:"status"`
	FirstName               *string           `json:"first_name"`
	LastName                *string           `json:"last_name"`
	Phone                   *string           `json:"phone"`
	Age                     *int16            `json:"age"`
	CountryOfResidence      *string           `json:"country_of_residence"`
	Gender                  *string           `json:"gender"`
	University              *string           `json:"university"`
	Major                   *string           `json:"major"`
	LevelOfStudy            *string           `json:"level_of_study"`
	HackathonsAttended      *int16            `json:"hackathons_attended"`
	SubmittedAt             *time.Time        `json:"submitted_at"`
	CreatedAt               time.Time         `json:"created_at"`
	UpdatedAt               time.Time         `json:"updated_at"`
	AcceptVotes             int               `json:"accept_votes"`
	RejectVotes             int               `json:"reject_votes"`
	WaitlistVotes           int               `json:"waitlist_votes"`
	ReviewsAssigned         int               `json:"reviews_assigned"`
	ReviewsCompleted        int               `json:"reviews_completed"`
	AIPercent               *int              `json:"ai_percent"`
	HasResume               bool              `json:"has_resume"`
}

// ApplicationListResult contains paginated results
type ApplicationListResult struct {
	Applications []ApplicationListItem `json:"applications"`
	NextCursor   *string               `json:"next_cursor,omitempty"`
	PrevCursor   *string               `json:"prev_cursor,omitempty"`
	HasMore      bool                  `json:"has_more"`
}

// ApplicationStats contains aggregated stats for all applications
type ApplicationStats struct {
	TotalApplications int64   `json:"total_applications"`
	Submitted         int64   `json:"submitted"`
	Accepted          int64   `json:"accepted"`
	Rejected          int64   `json:"rejected"`
	Waitlisted        int64   `json:"waitlisted"`
	Draft             int64   `json:"draft"`
	AcceptanceRate    float64 `json:"acceptance_rate"`
}

// EncodeCursor creates a base64-encoded cursor string for created_at sorting
func EncodeCursor(createdAt time.Time, id string) string {
	cursor := ApplicationCursor{CreatedAt: createdAt, ID: id}
	data, _ := json.Marshal(cursor)
	return base64.URLEncoding.EncodeToString(data)
}

// EncodeSortCursor creates a base64-encoded cursor string for vote-column sorting
func EncodeSortCursor(sortVal int, id string) string {
	cursor := ApplicationCursor{ID: id, SortVal: &sortVal}
	data, _ := json.Marshal(cursor)
	return base64.URLEncoding.EncodeToString(data)
}

// DecodeCursor parses a base64-encoded cursor string
func DecodeCursor(encoded string) (*ApplicationCursor, error) {
	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor encoding")
	}
	var cursor ApplicationCursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return nil, fmt.Errorf("invalid cursor format")
	}
	// Valid if either (CreatedAt + ID) or (SortVal + ID)
	if cursor.ID == "" {
		return nil, fmt.Errorf("invalid cursor: missing id")
	}
	if cursor.CreatedAt.IsZero() && cursor.SortVal == nil {
		return nil, fmt.Errorf("invalid cursor: missing sort value")
	}
	return &cursor, nil
}

type Application struct {
	ID     string            `json:"id"`
	UserID string            `json:"user_id"`
	Status ApplicationStatus `json:"status"`

	Responses  json.RawMessage `json:"responses"`
	ResumePath *string         `json:"resume_path"`
	AIPercent  *int16          `json:"ai_percent"`

	AckMLHCOC      bool `json:"ack_mlh_coc"`
	AckMLHPrivacy  bool `json:"ack_mlh_privacy"`
	OptInMLHEmails bool `json:"opt_in_mlh_emails"`

	AcceptVotes      int `json:"accept_votes"`
	RejectVotes      int `json:"reject_votes"`
	WaitlistVotes    int `json:"waitlist_votes"`
	ReviewsAssigned  int `json:"reviews_assigned"`
	ReviewsCompleted int `json:"reviews_completed"`

	SubmittedAt *time.Time `json:"submitted_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type ApplicationsStore struct {
	db *sql.DB
}

// applicationSelectCols is the standard SELECT for loading a full Application
const applicationSelectCols = `
	id, user_id, status, responses, resume_path, ai_percent,
	ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
	accept_votes, reject_votes, waitlist_votes, reviews_assigned, reviews_completed,
	submitted_at, created_at, updated_at`

// scanApplication scans a row into an Application struct
func scanApplication(row interface{ Scan(dest ...any) error }, app *Application) error {
	return row.Scan(
		&app.ID, &app.UserID, &app.Status, &app.Responses, &app.ResumePath, &app.AIPercent,
		&app.AckMLHCOC, &app.AckMLHPrivacy, &app.OptInMLHEmails,
		&app.AcceptVotes, &app.RejectVotes, &app.WaitlistVotes, &app.ReviewsAssigned, &app.ReviewsCompleted,
		&app.SubmittedAt, &app.CreatedAt, &app.UpdatedAt,
	)
}

func (s *ApplicationsStore) GetByID(ctx context.Context, id string) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT ` + applicationSelectCols + ` FROM applications WHERE id = $1`

	var app Application
	err := scanApplication(s.db.QueryRowContext(ctx, query, id), &app)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &app, nil
}

func (s *ApplicationsStore) GetByUserID(ctx context.Context, userID string) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT ` + applicationSelectCols + ` FROM applications WHERE user_id = $1`

	var app Application
	err := scanApplication(s.db.QueryRowContext(ctx, query, userID), &app)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &app, nil
}

func (s *ApplicationsStore) Create(ctx context.Context, app *Application) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO applications (user_id)
		VALUES ($1)
		RETURNING id, status, responses,
				  ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
				  created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.UserID).Scan(
		&app.ID, &app.Status, &app.Responses,
		&app.AckMLHCOC, &app.AckMLHPrivacy, &app.OptInMLHEmails,
		&app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "applications_user_id_key") {
			return ErrConflict
		}
		return err
	}

	return nil
}

func (s *ApplicationsStore) Update(ctx context.Context, app *Application) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications SET
			responses = $2,
			resume_path = $3,
			ack_mlh_coc = $4,
			ack_mlh_privacy = $5,
			opt_in_mlh_emails = $6
		WHERE id = $1
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		app.ID,
		app.Responses, app.ResumePath,
		app.AckMLHCOC, app.AckMLHPrivacy, app.OptInMLHEmails,
	).Scan(&app.UpdatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *ApplicationsStore) Submit(ctx context.Context, app *Application) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET status = 'submitted', submitted_at = NOW()
		WHERE id = $1 AND status = 'draft'
		RETURNING status, submitted_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.ID).Scan(
		&app.Status, &app.SubmittedAt, &app.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrConflict // Already submitted or not found
		}
		return err
	}
	return nil
}

// sortColumnName returns the SQL column name for a given sort key.
// Only whitelisted values are accepted to prevent SQL injection.
func sortColumnName(sortBy ApplicationSortBy) string {
	switch sortBy {
	case SortByAcceptVotes:
		return "a.accept_votes"
	case SortByRejectVotes:
		return "a.reject_votes"
	case SortByWaitlistVotes:
		return "a.waitlist_votes"
	default:
		return "a.created_at"
	}
}

// isVoteSort returns true if sorting by a vote column instead of created_at
func isVoteSort(sortBy ApplicationSortBy) bool {
	switch sortBy {
	case SortByAcceptVotes, SortByRejectVotes, SortByWaitlistVotes:
		return true
	default:
		return false
	}
}

// getVoteVal extracts the vote count from an ApplicationListItem based on the sort column
func getVoteVal(item ApplicationListItem, sortBy ApplicationSortBy) int {
	switch sortBy {
	case SortByAcceptVotes:
		return item.AcceptVotes
	case SortByRejectVotes:
		return item.RejectVotes
	case SortByWaitlistVotes:
		return item.WaitlistVotes
	default:
		return 0
	}
}

// Cursor pagination for applications
func (s *ApplicationsStore) List(
	ctx context.Context,
	filters ApplicationListFilters,
	cursor *ApplicationCursor,
	direction PaginationDirection,
	limit int,
) (*ApplicationListResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// default 50, max 100
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	sortBy := filters.SortBy
	if sortBy == "" {
		sortBy = SortByCreatedAt
	}
	voteSort := isVoteSort(sortBy)
	col := sortColumnName(sortBy)

	var searchParam *string
	if filters.Search != nil {
		searchParam = filters.Search
	}

	selectCols := `
		SELECT a.id, a.user_id, u.email, a.status,
		       a.responses->>'first_name' AS first_name,
		       a.responses->>'last_name' AS last_name,
		       a.responses->>'phone' AS phone,
		       NULLIF(a.responses->>'age', '')::smallint AS age,
		       a.responses->>'country_of_residence' AS country_of_residence,
		       a.responses->>'gender' AS gender,
		       a.responses->>'university' AS university,
		       a.responses->>'major' AS major,
		       a.responses->>'level_of_study' AS level_of_study,
		       NULLIF(a.responses->>'hackathons_attended', '')::smallint AS hackathons_attended,
		       a.submitted_at, a.created_at, a.updated_at,
		       a.accept_votes, a.reject_votes, a.waitlist_votes, a.reviews_assigned, a.reviews_completed, a.ai_percent,
		       a.resume_path IS NOT NULL AS has_resume
		FROM applications a
		INNER JOIN users u ON a.user_id = u.id`

	searchClause := `AND ($5::text IS NULL OR (
		    u.email ILIKE '%' || $5 || '%'
		    OR a.responses->>'first_name' ILIKE '%' || $5 || '%'
		    OR a.responses->>'last_name' ILIKE '%' || $5 || '%'
		))`

	// Fetch limit+1 to determine hasMore
	queryLimit := limit + 1

	var statusParam any
	if filters.Status != nil {
		statusParam = *filters.Status
	}

	var rows *sql.Rows
	var err error

	if voteSort {
		// Vote-column sorting: cursor uses (sort_val, id)
		var cursorVal *int
		var cursorID *string
		if cursor != nil {
			cursorVal = cursor.SortVal
			cursorID = &cursor.ID
		}

		var query string
		if direction == DirectionBackward && cursor != nil {
			// Backward: fetch items AFTER cursor in ASC order, then reverse
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND ($2::int IS NULL OR (%s, a.id) > ($2, $3::uuid))
				  %s
				ORDER BY %s ASC, a.id ASC
				LIMIT $4`, selectCols, col, searchClause, col)
		} else {
			// Forward (default): DESC order
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND ($2::int IS NULL OR (%s, a.id) < ($2, $3::uuid))
				  %s
				ORDER BY %s DESC, a.id DESC
				LIMIT $4`, selectCols, col, searchClause, col)
		}

		rows, err = s.db.QueryContext(ctx, query, statusParam, cursorVal, cursorID, queryLimit, searchParam)
	} else {
		// Default created_at sorting
		var cursorTime *time.Time
		var cursorID *string
		if cursor != nil {
			cursorTime = &cursor.CreatedAt
			cursorID = &cursor.ID
		}

		var query string
		if direction == DirectionBackward && cursor != nil {
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND (a.created_at, a.id) > ($2, $3::uuid)
				  %s
				ORDER BY a.created_at ASC, a.id ASC
				LIMIT $4`, selectCols, searchClause)
		} else {
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND ($2::timestamptz IS NULL OR (a.created_at, a.id) < ($2, $3::uuid))
				  %s
				ORDER BY a.created_at DESC, a.id DESC
				LIMIT $4`, selectCols, searchClause)
		}

		rows, err = s.db.QueryContext(ctx, query, statusParam, cursorTime, cursorID, queryLimit, searchParam)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ApplicationListItem, 0, limit)
	for rows.Next() {
		var item ApplicationListItem
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Email, &item.Status,
			&item.FirstName, &item.LastName, &item.Phone, &item.Age,
			&item.CountryOfResidence, &item.Gender,
			&item.University, &item.Major, &item.LevelOfStudy,
			&item.HackathonsAttended,
			&item.SubmittedAt, &item.CreatedAt, &item.UpdatedAt,
			&item.AcceptVotes, &item.RejectVotes, &item.WaitlistVotes, &item.ReviewsAssigned, &item.ReviewsCompleted, &item.AIPercent,
			&item.HasResume,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	// Reverse if backward direction
	if direction == DirectionBackward {
		for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
			items[i], items[j] = items[j], items[i]
		}
	}

	result := &ApplicationListResult{
		Applications: items,
		HasMore:      hasMore,
	}

	// Generate cursors
	if len(items) > 0 {
		if direction == DirectionBackward {
			lastItem := items[len(items)-1]
			nc := s.encodeCursorForItem(lastItem, sortBy, voteSort)
			result.NextCursor = &nc

			if hasMore {
				firstItem := items[0]
				pc := s.encodeCursorForItem(firstItem, sortBy, voteSort)
				result.PrevCursor = &pc
			}
		} else {
			if hasMore {
				lastItem := items[len(items)-1]
				nc := s.encodeCursorForItem(lastItem, sortBy, voteSort)
				result.NextCursor = &nc
			}

			if cursor != nil {
				firstItem := items[0]
				pc := s.encodeCursorForItem(firstItem, sortBy, voteSort)
				result.PrevCursor = &pc
			}
		}
	}

	return result, nil
}

func (s *ApplicationsStore) encodeCursorForItem(item ApplicationListItem, sortBy ApplicationSortBy, voteSort bool) string {
	if voteSort {
		return EncodeSortCursor(getVoteVal(item, sortBy), item.ID)
	}
	return EncodeCursor(item.CreatedAt, item.ID)
}

func (s *ApplicationsStore) SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET status = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING ` + applicationSelectCols

	var app Application
	err := scanApplication(s.db.QueryRowContext(ctx, query, id, status), &app)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &app, nil
}

// GetStats returns aggregated application statistics
func (s *ApplicationsStore) GetStats(ctx context.Context) (*ApplicationStats, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
			COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
			COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
			COUNT(*) FILTER (WHERE status = 'waitlisted') AS waitlisted,
			COUNT(*) FILTER (WHERE status = 'draft') AS draft
		FROM applications
	`

	var stats ApplicationStats
	err := s.db.QueryRowContext(ctx, query).Scan(
		&stats.TotalApplications,
		&stats.Submitted,
		&stats.Accepted,
		&stats.Rejected,
		&stats.Waitlisted,
		&stats.Draft,
	)
	if err != nil {
		return nil, err
	}

	// Calculate acceptance rate: accepted / (submitted + accepted + rejected + waitlisted)
	reviewed := stats.Submitted + stats.Accepted + stats.Rejected + stats.Waitlisted
	if reviewed > 0 {
		stats.AcceptanceRate = float64(stats.Accepted) / float64(reviewed) * 100
	}

	return &stats, nil
}

type UserEmailInfo struct {
	UserID    string  `json:"user_id"`
	Email     string  `json:"email"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
}

func (s *ApplicationsStore) GetEmailsByStatus(ctx context.Context, status ApplicationStatus) ([]UserEmailInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT a.user_id, u.email,
		       a.responses->>'first_name' AS first_name,
		       a.responses->>'last_name' AS last_name
		FROM applications a
		INNER JOIN users u ON a.user_id = u.id
		WHERE a.status = $1
		ORDER BY u.email`

	rows, err := s.db.QueryContext(ctx, query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []UserEmailInfo
	for rows.Next() {
		var u UserEmailInfo
		if err := rows.Scan(&u.UserID, &u.Email, &u.FirstName, &u.LastName); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}
