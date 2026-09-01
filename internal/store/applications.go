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

// RSVPStatus tracks whether an accepted hacker has claimed or declined their spot
type RSVPStatus string

const (
	RSVPPending   RSVPStatus = "pending"
	RSVPConfirmed RSVPStatus = "confirmed"
	RSVPDeclined  RSVPStatus = "declined"
)

// TravelStatus tracks the travel reimbursement review state for an application
type TravelStatus string

const (
	TravelNotRequested TravelStatus = "not_requested"
	TravelPending      TravelStatus = "pending"
	TravelApproved     TravelStatus = "approved"
	TravelRejected     TravelStatus = "rejected"
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
	SortByCreatedAt      ApplicationSortBy = "created_at"
	SortByAcceptVotes    ApplicationSortBy = "accept_votes"
	SortByRejectVotes    ApplicationSortBy = "reject_votes"
	SortByWaitlistVotes  ApplicationSortBy = "waitlist_votes"
	SortByTravelYesVotes ApplicationSortBy = "travel_yes_votes"
)

// ApplicationCursor represents pagination cursor
type ApplicationCursor struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
	SortVal   *int      `json:"v,omitempty"` // used for vote-column sorting
}

// ApplicationListFilters for query filtering
type ApplicationListFilters struct {
	Status           *ApplicationStatus
	TravelStatus     *TravelStatus
	RSVPStatus       *RSVPStatus
	TravelRSVPStatus *RSVPStatus
	HasReceipts      *bool
	TravelRequested  *bool
	Search           *string
	SortBy           ApplicationSortBy
}

// ApplicationListItem is a lightweight view for admin listing
type ApplicationListItem struct {
	ID                        string            `json:"id"`
	UserID                    string            `json:"user_id"`
	Email                     string            `json:"email"`
	Status                    ApplicationStatus `json:"status"`
	FirstName                 *string           `json:"first_name"`
	LastName                  *string           `json:"last_name"`
	Phone                     *string           `json:"phone"`
	Age                       *int16            `json:"age"`
	CountryOfResidence        *string           `json:"country_of_residence"`
	Gender                    *string           `json:"gender"`
	University                *string           `json:"university"`
	Major                     *string           `json:"major"`
	LevelOfStudy              *string           `json:"level_of_study"`
	HackathonsAttended        *int16            `json:"hackathons_attended"`
	SubmittedAt               *time.Time        `json:"submitted_at"`
	CreatedAt                 time.Time         `json:"created_at"`
	UpdatedAt                 time.Time         `json:"updated_at"`
	AcceptVotes               int               `json:"accept_votes"`
	RejectVotes               int               `json:"reject_votes"`
	WaitlistVotes             int               `json:"waitlist_votes"`
	ReviewsAssigned           int               `json:"reviews_assigned"`
	ReviewsCompleted          int               `json:"reviews_completed"`
	AIPercent                 *int              `json:"ai_percent"`
	HasResume                 bool              `json:"has_resume"`
	MealGroup                 *string           `json:"meal_group"`
	Points                    int               `json:"points"`
	TravelStatus              TravelStatus      `json:"travel_status"`
	TravelYesVotes            int               `json:"travel_yes_votes"`
	TravelNoVotes             int               `json:"travel_no_votes"`
	TravelApprovedAmountCents *int64            `json:"travel_approved_amount_cents"`
	// RSVPStatus and TravelRSVPStatus let the review UI tell whether the hacker
	// has already acted on a one-shot RSVP, which pins the travel decision.
	RSVPStatus               RSVPStatus `json:"rsvp_status"`
	TravelRSVPStatus         RSVPStatus `json:"travel_rsvp_status"`
	RSVPSubmittedAt          *time.Time `json:"rsvp_submitted_at"`
	TravelRSVPSubmittedAt    *time.Time `json:"travel_rsvp_submitted_at"`
	ReceiptCount             int        `json:"receipt_count"`
	EstimatedTravelCostCents *int64     `json:"estimated_travel_cost_cents"`
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

// FormOperationsStats is the super-admin operational view of the three
// participant forms. Counts use people rather than files unless the field name
// explicitly says ReceiptFiles.
type FormOperationsStats struct {
	Applications ApplicationFormStats `json:"applications"`
	RSVP         RSVPFormStats        `json:"rsvp"`
	Travel       TravelFormStats      `json:"travel"`
}

type ApplicationFormStats struct {
	Started          int64      `json:"started"`
	Drafts           int64      `json:"drafts"`
	Submitted        int64      `json:"submitted"`
	AwaitingDecision int64      `json:"awaiting_decision"`
	Accepted         int64      `json:"accepted"`
	Rejected         int64      `json:"rejected"`
	Waitlisted       int64      `json:"waitlisted"`
	CompletionRate   float64    `json:"completion_rate"`
	LatestSubmission *time.Time `json:"latest_submission"`
}

type RSVPFormStats struct {
	Eligible       int64      `json:"eligible"`
	Pending        int64      `json:"pending"`
	Confirmed      int64      `json:"confirmed"`
	Declined       int64      `json:"declined"`
	ResponseRate   float64    `json:"response_rate"`
	LatestResponse *time.Time `json:"latest_response"`
}

type TravelFormStats struct {
	Requested                  int64      `json:"requested"`
	DecisionPending            int64      `json:"decision_pending"`
	Approved                   int64      `json:"approved"`
	Rejected                   int64      `json:"rejected"`
	FormEligible               int64      `json:"form_eligible"`
	FormPending                int64      `json:"form_pending"`
	FormSubmitted              int64      `json:"form_submitted"`
	FormDeclined               int64      `json:"form_declined"`
	PeopleWithReceipts         int64      `json:"people_with_receipts"`
	ReceiptFiles               int64      `json:"receipt_files"`
	RequestedEstimateCents     int64      `json:"requested_estimate_cents"`
	ApprovedAmountCents        int64      `json:"approved_amount_cents"`
	LatestTravelFormSubmission *time.Time `json:"latest_travel_form_submission"`
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

	AcceptVotes      int `json:"accept_votes"`
	RejectVotes      int `json:"reject_votes"`
	WaitlistVotes    int `json:"waitlist_votes"`
	ReviewsAssigned  int `json:"reviews_assigned"`
	ReviewsCompleted int `json:"reviews_completed"`

	SubmittedAt *time.Time `json:"submitted_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	MealGroup   *string    `json:"meal_group"`

	RSVPStatus      RSVPStatus      `json:"rsvp_status"`
	RSVPResponses   json.RawMessage `json:"rsvp_responses" swaggertype:"object"`
	RSVPSubmittedAt *time.Time      `json:"rsvp_submitted_at"`

	TravelStatus              TravelStatus `json:"travel_status"`
	TravelYesVotes            int          `json:"travel_yes_votes"`
	TravelNoVotes             int          `json:"travel_no_votes"`
	TravelApprovedAmountCents *int64       `json:"travel_approved_amount_cents"`

	TravelRSVPStatus      RSVPStatus      `json:"travel_rsvp_status"`
	TravelRSVPResponses   json.RawMessage `json:"travel_rsvp_responses" swaggertype:"object"`
	TravelRSVPSubmittedAt *time.Time      `json:"travel_rsvp_submitted_at"`
	TravelReceiptPaths    StringArray     `json:"travel_receipt_paths" swaggertype:"array,string"`
}

type ApplicationsStore struct {
	db *sql.DB
}

// applicationSelectCols is the standard SELECT for loading a full Application
const applicationSelectCols = `
	id, user_id, status, responses, resume_path, ai_percent,
	accept_votes, reject_votes, waitlist_votes, reviews_assigned, reviews_completed,
	submitted_at, created_at, updated_at, meal_group,
	rsvp_status, rsvp_responses, rsvp_submitted_at,
	travel_status, travel_yes_votes, travel_no_votes, travel_approved_amount_cents,
	travel_rsvp_status, travel_rsvp_responses, travel_rsvp_submitted_at, travel_receipt_paths`

// scanApplication scans a row into an Application struct
func scanApplication(row interface{ Scan(dest ...any) error }, app *Application) error {
	return row.Scan(
		&app.ID, &app.UserID, &app.Status, &app.Responses, &app.ResumePath, &app.AIPercent,
		&app.AcceptVotes, &app.RejectVotes, &app.WaitlistVotes, &app.ReviewsAssigned, &app.ReviewsCompleted,
		&app.SubmittedAt, &app.CreatedAt, &app.UpdatedAt, &app.MealGroup,
		&app.RSVPStatus, &app.RSVPResponses, &app.RSVPSubmittedAt,
		&app.TravelStatus, &app.TravelYesVotes, &app.TravelNoVotes, &app.TravelApprovedAmountCents,
		&app.TravelRSVPStatus, &app.TravelRSVPResponses, &app.TravelRSVPSubmittedAt, &app.TravelReceiptPaths,
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
		RETURNING id, status, responses, created_at, updated_at, rsvp_status, rsvp_responses, travel_status, travel_rsvp_status, travel_rsvp_responses
	`

	err := s.db.QueryRowContext(ctx, query, app.UserID).Scan(
		&app.ID, &app.Status, &app.Responses,
		&app.CreatedAt, &app.UpdatedAt,
		&app.RSVPStatus, &app.RSVPResponses,
		&app.TravelStatus,
		&app.TravelRSVPStatus, &app.TravelRSVPResponses,
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
			resume_path = $3
		WHERE id = $1
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		app.ID,
		app.Responses, app.ResumePath,
	).Scan(&app.UpdatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// Submit finalizes a draft application. travelOptInFieldID names the schema
// checkbox that opts the applicant into travel reimbursement review; it is
// passed in rather than hard-coded because super admins can edit the schema.
// An empty ID (no such field in the schema) means no one requests travel.
func (s *ApplicationsStore) Submit(ctx context.Context, app *Application, travelOptInFieldID string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET status = 'submitted', submitted_at = NOW(),
		    travel_status = CASE
		        WHEN $2::text != '' AND responses->($2::text) = 'true'::jsonb THEN 'pending'::travel_status
		        ELSE 'not_requested'::travel_status
		    END
		WHERE id = $1 AND status = 'draft'
		RETURNING status, submitted_at, updated_at, travel_status
	`

	err := s.db.QueryRowContext(ctx, query, app.ID, travelOptInFieldID).Scan(
		&app.Status, &app.SubmittedAt, &app.UpdatedAt, &app.TravelStatus,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrConflict // Already submitted or not found
		}
		return err
	}
	return nil
}

// SubmitRSVP records the hacker's one-shot RSVP decision. The WHERE clause
// enforces the state machine in SQL: only accepted applications with a
// pending RSVP can transition, so concurrent submits resolve to ErrConflict.
func (s *ApplicationsStore) SubmitRSVP(ctx context.Context, app *Application) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET rsvp_status = $2, rsvp_responses = $3, rsvp_submitted_at = NOW()
		WHERE id = $1 AND status = 'accepted' AND rsvp_status = 'pending'
		RETURNING rsvp_status, rsvp_responses, rsvp_submitted_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.ID, app.RSVPStatus, app.RSVPResponses).Scan(
		&app.RSVPStatus, &app.RSVPResponses, &app.RSVPSubmittedAt, &app.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrConflict // Already RSVP'd or not accepted
		}
		return err
	}
	return nil
}

// SubmitTravelRSVP records the hacker's one-shot travel RSVP (proof of travel).
// The WHERE clause enforces the state machine in SQL: only accepted hackers who
// claimed their spot and have approved travel with a pending travel RSVP can
// transition, so concurrent submits resolve to ErrConflict.
func (s *ApplicationsStore) SubmitTravelRSVP(ctx context.Context, app *Application) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET travel_rsvp_status = $2, travel_rsvp_responses = $3, travel_receipt_paths = $4, travel_rsvp_submitted_at = NOW()
		WHERE id = $1 AND status = 'accepted' AND rsvp_status = 'confirmed'
		  AND travel_status = 'approved' AND travel_rsvp_status = 'pending'
		RETURNING travel_rsvp_status, travel_rsvp_responses, travel_receipt_paths, travel_rsvp_submitted_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.ID, app.TravelRSVPStatus, app.TravelRSVPResponses, app.TravelReceiptPaths).Scan(
		&app.TravelRSVPStatus, &app.TravelRSVPResponses, &app.TravelReceiptPaths, &app.TravelRSVPSubmittedAt, &app.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrConflict // Already submitted or not eligible
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
	case SortByTravelYesVotes:
		return "a.travel_yes_votes"
	default:
		return "a.created_at"
	}
}

// isVoteSort returns true if sorting by a vote column instead of created_at
func isVoteSort(sortBy ApplicationSortBy) bool {
	switch sortBy {
	case SortByAcceptVotes, SortByRejectVotes, SortByWaitlistVotes, SortByTravelYesVotes:
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
	case SortByTravelYesVotes:
		return item.TravelYesVotes
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

	// responses is free-text JSONB, so a hacker can store any string in a
	// numeric field. A bare ::smallint cast makes one out-of-range value fail
	// the whole query and 500 the list for every admin, so only values that
	// provably fit are cast; anything else reads as NULL.
	selectCols := `
		SELECT a.id, a.user_id, u.email, a.status,
		       a.responses->>'first_name' AS first_name,
		       a.responses->>'last_name' AS last_name,
		       a.responses->>'phone' AS phone,
		       CASE WHEN a.responses->>'age' ~ '^[0-9]{1,3}$'
		            THEN (a.responses->>'age')::smallint END AS age,
		       a.responses->>'country_of_residence' AS country_of_residence,
		       a.responses->>'gender' AS gender,
		       a.responses->>'university' AS university,
		       a.responses->>'major' AS major,
		       a.responses->>'level_of_study' AS level_of_study,
		       CASE WHEN a.responses->>'hackathons_attended' ~ '^[0-9]{1,4}$'
		            THEN (a.responses->>'hackathons_attended')::smallint END AS hackathons_attended,
		       a.submitted_at, a.created_at, a.updated_at,
		       a.accept_votes, a.reject_votes, a.waitlist_votes, a.reviews_assigned, a.reviews_completed, a.ai_percent,
		       a.resume_path IS NOT NULL AS has_resume, a.meal_group,
		       (SELECT COALESCE(SUM(s.points), 0) FROM scans s WHERE s.user_id = a.user_id) AS points,
		       a.travel_status, a.travel_yes_votes, a.travel_no_votes, a.travel_approved_amount_cents,
		       a.rsvp_status, a.travel_rsvp_status,
		       a.rsvp_submitted_at, a.travel_rsvp_submitted_at,
		       CARDINALITY(a.travel_receipt_paths) AS receipt_count,
		       CASE WHEN a.responses->>'travel_estimated_cost' ~ '^[0-9]+([.][0-9]{1,2})?$'
		            THEN ROUND((a.responses->>'travel_estimated_cost')::numeric * 100)::bigint END AS estimated_travel_cost_cents
		FROM applications a
		INNER JOIN users u ON a.user_id = u.id`

	filterClause := `AND ($5::text IS NULL OR (
		    u.email ILIKE '%' || $5 || '%'
		    OR a.responses->>'first_name' ILIKE '%' || $5 || '%'
		    OR a.responses->>'last_name' ILIKE '%' || $5 || '%'
		))
		  AND ($6::travel_status IS NULL OR a.travel_status = $6)
		  AND ($7::rsvp_status IS NULL OR a.rsvp_status = $7)
		  AND ($8::rsvp_status IS NULL OR a.travel_rsvp_status = $8)
		  AND ($9::boolean IS NULL OR (CARDINALITY(a.travel_receipt_paths) > 0) = $9)
		  AND ($10::boolean IS NULL OR (a.travel_status != 'not_requested') = $10)`

	// Fetch limit+1 to determine hasMore
	queryLimit := limit + 1

	var statusParam any
	if filters.Status != nil {
		statusParam = *filters.Status
	}

	var travelStatusParam any
	if filters.TravelStatus != nil {
		travelStatusParam = *filters.TravelStatus
	}

	var rsvpStatusParam any
	if filters.RSVPStatus != nil {
		rsvpStatusParam = *filters.RSVPStatus
	}

	var travelRSVPStatusParam any
	if filters.TravelRSVPStatus != nil {
		travelRSVPStatusParam = *filters.TravelRSVPStatus
	}

	var hasReceiptsParam any
	if filters.HasReceipts != nil {
		hasReceiptsParam = *filters.HasReceipts
	}

	var travelRequestedParam any
	if filters.TravelRequested != nil {
		travelRequestedParam = *filters.TravelRequested
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
				LIMIT $4`, selectCols, col, filterClause, col)
		} else {
			// Forward (default): DESC order
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND ($2::int IS NULL OR (%s, a.id) < ($2, $3::uuid))
				  %s
				ORDER BY %s DESC, a.id DESC
				LIMIT $4`, selectCols, col, filterClause, col)
		}

		rows, err = s.db.QueryContext(ctx, query, statusParam, cursorVal, cursorID, queryLimit, searchParam, travelStatusParam, rsvpStatusParam, travelRSVPStatusParam, hasReceiptsParam, travelRequestedParam)
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
				LIMIT $4`, selectCols, filterClause)
		} else {
			query = fmt.Sprintf(`%s
				WHERE ($1::application_status IS NULL OR a.status = $1)
				  AND ($2::timestamptz IS NULL OR (a.created_at, a.id) < ($2, $3::uuid))
				  %s
				ORDER BY a.created_at DESC, a.id DESC
				LIMIT $4`, selectCols, filterClause)
		}

		rows, err = s.db.QueryContext(ctx, query, statusParam, cursorTime, cursorID, queryLimit, searchParam, travelStatusParam, rsvpStatusParam, travelRSVPStatusParam, hasReceiptsParam, travelRequestedParam)
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
			&item.HasResume, &item.MealGroup, &item.Points,
			&item.TravelStatus, &item.TravelYesVotes, &item.TravelNoVotes, &item.TravelApprovedAmountCents,
			&item.RSVPStatus, &item.TravelRSVPStatus,
			&item.RSVPSubmittedAt, &item.TravelRSVPSubmittedAt,
			&item.ReceiptCount, &item.EstimatedTravelCostCents,
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

// SetTravelStatus sets the travel reimbursement decision on an application.
// The WHERE clause enforces the state machine in SQL:
//   - the applicant must have requested travel (travel_status != 'not_requested')
//   - the application must be in a status that can carry a decision; a draft has
//     not asked for anything yet and a rejected applicant has nothing to reimburse
//   - a submitted travel RSVP pins the travel status, since revoking approval
//     would strand the details and receipts the hacker already sent. Re-setting
//     the status to its current value stays allowed so the call is idempotent.
//
// Refusals come back as one of the ErrTravel* conflicts (all of which wrap
// ErrConflict), or ErrNotFound when no such application exists.
func (s *ApplicationsStore) SetTravelStatus(ctx context.Context, id string, status TravelStatus, approvedAmountCents *int64) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET travel_status = $2::travel_status,
		    travel_approved_amount_cents = CASE
		        WHEN $2::travel_status = 'approved'::travel_status THEN $3::bigint
		        ELSE NULL::bigint
		    END,
		    updated_at = NOW()
		WHERE id = $1
		  AND travel_status != 'not_requested'
		  AND status IN ('submitted', 'accepted', 'waitlisted')
		  AND (travel_rsvp_status = 'pending' OR travel_status = $2::travel_status)
		RETURNING ` + applicationSelectCols

	var app Application
	err := scanApplication(s.db.QueryRowContext(ctx, query, id, status, approvedAmountCents), &app)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, s.travelStatusConflict(ctx, id)
		}
		return nil, err
	}

	return &app, nil
}

// travelStatusConflict inspects the row a SetTravelStatus update did not match
// so the caller can report which guard rejected the decision.
func (s *ApplicationsStore) travelStatusConflict(ctx context.Context, id string) error {
	var (
		appStatus        ApplicationStatus
		travelStatus     TravelStatus
		travelRSVPStatus RSVPStatus
	)

	err := s.db.QueryRowContext(ctx,
		`SELECT status, travel_status, travel_rsvp_status FROM applications WHERE id = $1`, id,
	).Scan(&appStatus, &travelStatus, &travelRSVPStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	switch {
	case travelStatus == TravelNotRequested:
		return ErrTravelNotRequested
	case appStatus != StatusSubmitted && appStatus != StatusAccepted && appStatus != StatusWaitlisted:
		return ErrTravelStatusNotDecidable
	case travelRSVPStatus != RSVPPending:
		return ErrTravelRSVPSubmitted
	default:
		// The row satisfies every guard, so a concurrent write moved it between
		// the update and this read.
		return ErrConflict
	}
}

// ResetRSVP clears a submitted RSVP so the hacker can claim or decline their
// spot again. The travel RSVP is cleared along with it: it is only reachable
// through a confirmed RSVP, so leaving it behind would strand travel details
// under a spot that is no longer claimed. Returns the detached receipt paths so
// the caller can remove the objects from storage.
func (s *ApplicationsStore) ResetRSVP(ctx context.Context, id string) (*Application, []string, error) {
	query := `
		UPDATE applications
		SET rsvp_status = 'pending',
		    rsvp_responses = '{}'::jsonb,
		    rsvp_submitted_at = NULL,
		    travel_rsvp_status = 'pending',
		    travel_rsvp_responses = '{}'::jsonb,
		    travel_rsvp_submitted_at = NULL,
		    travel_receipt_paths = '{}',
		    updated_at = NOW()
		WHERE id = $1
		RETURNING ` + applicationSelectCols

	return s.resetRSVPState(ctx, id, query)
}

// ResetTravelRSVP clears a submitted travel RSVP so the hacker can fill the
// travel form again, and returns the detached receipt paths so the caller can
// remove the objects from storage. The event RSVP is left untouched.
func (s *ApplicationsStore) ResetTravelRSVP(ctx context.Context, id string) (*Application, []string, error) {
	query := `
		UPDATE applications
		SET travel_rsvp_status = 'pending',
		    travel_rsvp_responses = '{}'::jsonb,
		    travel_rsvp_submitted_at = NULL,
		    travel_receipt_paths = '{}',
		    updated_at = NOW()
		WHERE id = $1
		RETURNING ` + applicationSelectCols

	return s.resetRSVPState(ctx, id, query)
}

// resetRSVPState runs an RSVP reset, reading the receipt paths inside the same
// transaction so the caller never deletes objects for an update that rolled back.
func (s *ApplicationsStore) resetRSVPState(ctx context.Context, id string, query string) (*Application, []string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	var receiptPaths StringArray
	err = tx.QueryRowContext(ctx,
		`SELECT travel_receipt_paths FROM applications WHERE id = $1 FOR UPDATE`, id,
	).Scan(&receiptPaths)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	var app Application
	if err := scanApplication(tx.QueryRowContext(ctx, query, id), &app); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}

	return &app, receiptPaths, nil
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

// GetFormOperationsStats returns the cross-form funnel and travel financial
// totals used by the super-admin Forms & Responses workspace. Currency is
// returned as integer cents so dashboard totals do not accumulate float error.
func (s *ApplicationsStore) GetFormOperationsStats(ctx context.Context) (*FormOperationsStats, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		WITH normalized AS (
			SELECT *,
				CASE WHEN responses->>'travel_estimated_cost' ~ '^[0-9]+([.][0-9]{1,2})?$'
					THEN ROUND((responses->>'travel_estimated_cost')::numeric * 100)::bigint
					ELSE 0 END AS requested_cents
			FROM applications
		)
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'draft'),
			COUNT(*) FILTER (WHERE status != 'draft'),
			COUNT(*) FILTER (WHERE status = 'submitted'),
			COUNT(*) FILTER (WHERE status = 'accepted'),
			COUNT(*) FILTER (WHERE status = 'rejected'),
			COUNT(*) FILTER (WHERE status = 'waitlisted'),
			MAX(submitted_at),

			COUNT(*) FILTER (WHERE status = 'accepted'),
			COUNT(*) FILTER (WHERE status = 'accepted' AND rsvp_status = 'pending'),
			COUNT(*) FILTER (WHERE status = 'accepted' AND rsvp_status = 'confirmed'),
			COUNT(*) FILTER (WHERE status = 'accepted' AND rsvp_status = 'declined'),
			MAX(rsvp_submitted_at),

			COUNT(*) FILTER (WHERE travel_status != 'not_requested'),
			COUNT(*) FILTER (WHERE travel_status = 'pending'),
			COUNT(*) FILTER (WHERE travel_status = 'approved'),
			COUNT(*) FILTER (WHERE travel_status = 'rejected'),
			COUNT(*) FILTER (WHERE status = 'accepted' AND rsvp_status = 'confirmed' AND travel_status = 'approved'),
			COUNT(*) FILTER (WHERE status = 'accepted' AND rsvp_status = 'confirmed' AND travel_status = 'approved' AND travel_rsvp_status = 'pending'),
			COUNT(*) FILTER (WHERE travel_rsvp_status = 'confirmed'),
			COUNT(*) FILTER (WHERE travel_rsvp_status = 'declined'),
			COUNT(*) FILTER (WHERE CARDINALITY(travel_receipt_paths) > 0),
			COALESCE(SUM(CARDINALITY(travel_receipt_paths)), 0),
			COALESCE(SUM(requested_cents) FILTER (WHERE travel_status != 'not_requested'), 0),
			COALESCE(SUM(travel_approved_amount_cents) FILTER (WHERE travel_status = 'approved'), 0),
			MAX(travel_rsvp_submitted_at)
		FROM normalized`

	var stats FormOperationsStats
	err := s.db.QueryRowContext(ctx, query).Scan(
		&stats.Applications.Started,
		&stats.Applications.Drafts,
		&stats.Applications.Submitted,
		&stats.Applications.AwaitingDecision,
		&stats.Applications.Accepted,
		&stats.Applications.Rejected,
		&stats.Applications.Waitlisted,
		&stats.Applications.LatestSubmission,
		&stats.RSVP.Eligible,
		&stats.RSVP.Pending,
		&stats.RSVP.Confirmed,
		&stats.RSVP.Declined,
		&stats.RSVP.LatestResponse,
		&stats.Travel.Requested,
		&stats.Travel.DecisionPending,
		&stats.Travel.Approved,
		&stats.Travel.Rejected,
		&stats.Travel.FormEligible,
		&stats.Travel.FormPending,
		&stats.Travel.FormSubmitted,
		&stats.Travel.FormDeclined,
		&stats.Travel.PeopleWithReceipts,
		&stats.Travel.ReceiptFiles,
		&stats.Travel.RequestedEstimateCents,
		&stats.Travel.ApprovedAmountCents,
		&stats.Travel.LatestTravelFormSubmission,
	)
	if err != nil {
		return nil, err
	}

	if stats.Applications.Started > 0 {
		stats.Applications.CompletionRate = float64(stats.Applications.Submitted) / float64(stats.Applications.Started) * 100
	}
	if stats.RSVP.Eligible > 0 {
		stats.RSVP.ResponseRate = float64(stats.RSVP.Confirmed+stats.RSVP.Declined) / float64(stats.RSVP.Eligible) * 100
	}

	return &stats, nil
}

type UserEmailInfo struct {
	UserID    string  `json:"user_id"`
	Email     string  `json:"email"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
}

func (s *ApplicationsStore) GetStatusByUserID(ctx context.Context, userID string) (ApplicationStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var status ApplicationStatus
	err := s.db.QueryRowContext(ctx,
		`SELECT status FROM applications WHERE user_id = $1`, userID).Scan(&status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return status, nil
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

// SetMealGroup assigns a meal group to an application only if one is not already set
func (s *ApplicationsStore) SetMealGroup(ctx context.Context, id string, mealGroup string) (*string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE applications
		SET meal_group = COALESCE(meal_group, $2),
		    updated_at = CASE WHEN meal_group IS NULL THEN NOW() ELSE updated_at END
		WHERE id = $1
		RETURNING meal_group
	`

	var assigned *string
	err := s.db.QueryRowContext(ctx, query, id, mealGroup).Scan(&assigned)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return assigned, nil
}

// GetMealGroupByUserID returns the assigned meal group for a user
func (s *ApplicationsStore) GetMealGroupByUserID(ctx context.Context, userID string) (*string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var mealGroup *string
	err := s.db.QueryRowContext(ctx, "SELECT meal_group FROM applications WHERE user_id = $1", userID).Scan(&mealGroup)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return mealGroup, err
}

// DecisionEmailKind identifies which outbound email blast a send belongs to.
// Each kind is tracked in its own column so an announcement never suppresses
// the per-decision email, or vice versa.
type DecisionEmailKind string

const (
	// DecisionEmailKindDecision is the per-status email that tells an applicant
	// whether they were accepted, waitlisted, or rejected.
	DecisionEmailKindDecision DecisionEmailKind = "decision"
	// DecisionEmailKindAnnouncement is the neutral "decisions are out" blast that
	// deliberately does not reveal the outcome.
	DecisionEmailKindAnnouncement DecisionEmailKind = "announcement"
)

// DecisionEmailStatuses are the only statuses a decision email may be sent to.
// Draft and submitted applicants have no decision to communicate.
var DecisionEmailStatuses = []ApplicationStatus{StatusAccepted, StatusWaitlisted, StatusRejected}

// decisionEmailColumn maps a kind to its tracking column. The value is
// interpolated into SQL, so only whitelisted kinds are accepted to prevent
// SQL injection.
func decisionEmailColumn(kind DecisionEmailKind) (string, error) {
	switch kind {
	case DecisionEmailKindDecision:
		return "decision_email_sent_at", nil
	case DecisionEmailKindAnnouncement:
		return "announcement_email_sent_at", nil
	}
	return "", fmt.Errorf("unknown decision email kind: %q", kind)
}

type DecisionEmailRecipient struct {
	ApplicationID string            `json:"application_id"`
	UserID        string            `json:"user_id"`
	Email         string            `json:"email"`
	FirstName     *string           `json:"first_name"`
	LastName      *string           `json:"last_name"`
	Status        ApplicationStatus `json:"status"`
}

type EmailSendCounts struct {
	Total   int64 `json:"total"`
	Sent    int64 `json:"sent"`
	Pending int64 `json:"pending"`
}

type DecisionEmailStats struct {
	Accepted     EmailSendCounts `json:"accepted"`
	Waitlisted   EmailSendCounts `json:"waitlisted"`
	Rejected     EmailSendCounts `json:"rejected"`
	Announcement EmailSendCounts `json:"announcement"`
}

// GetDecisionEmailRecipients returns applicants in the given statuses. When
// onlyUnsent is true, anyone already emailed for this kind is excluded.
func (s *ApplicationsStore) GetDecisionEmailRecipients(ctx context.Context, statuses []ApplicationStatus, kind DecisionEmailKind, onlyUnsent bool) ([]DecisionEmailRecipient, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	if len(statuses) == 0 {
		return nil, nil
	}

	column, err := decisionEmailColumn(kind)
	if err != nil {
		return nil, err
	}

	statusValues := make([]string, len(statuses))
	for i, status := range statuses {
		statusValues[i] = string(status)
	}

	query := `
		SELECT a.id, a.user_id, u.email,
		       a.responses->>'first_name' AS first_name,
		       a.responses->>'last_name' AS last_name,
		       a.status
		FROM applications a
		INNER JOIN users u ON a.user_id = u.id
		WHERE a.status = ANY($1::application_status[])`

	if onlyUnsent {
		query += "\n\t\t  AND a." + column + " IS NULL"
	}

	query += "\n\t\tORDER BY u.email"

	rows, err := s.db.QueryContext(ctx, query, statusValues)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recipients []DecisionEmailRecipient
	for rows.Next() {
		var recipient DecisionEmailRecipient
		if err := rows.Scan(
			&recipient.ApplicationID,
			&recipient.UserID,
			&recipient.Email,
			&recipient.FirstName,
			&recipient.LastName,
			&recipient.Status,
		); err != nil {
			return nil, err
		}
		recipients = append(recipients, recipient)
	}

	return recipients, rows.Err()
}

// SetDecisionEmailSent stamps (sent=true) or clears (sent=false) the tracking
// column for the given applications. Clearing is how failed sends are handed
// back so a later run retries only them.
func (s *ApplicationsStore) SetDecisionEmailSent(ctx context.Context, applicationIDs []string, kind DecisionEmailKind, sent bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration*2)
	defer cancel()

	if len(applicationIDs) == 0 {
		return nil
	}

	column, err := decisionEmailColumn(kind)
	if err != nil {
		return err
	}

	value := "NULL"
	if sent {
		value = "NOW()"
	}

	query := `
		UPDATE applications
		SET ` + column + ` = ` + value + `
		WHERE id = ANY($1::uuid[])`

	_, err = s.db.ExecContext(ctx, query, applicationIDs)
	return err
}

// GetDecisionEmailStats returns per-status sent/pending counts for both email
// kinds, so the Send Emails dialog can show what a run would actually do.
func (s *ApplicationsStore) GetDecisionEmailStats(ctx context.Context) (*DecisionEmailStats, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_total,
			COUNT(*) FILTER (WHERE status = 'accepted' AND decision_email_sent_at IS NOT NULL) AS accepted_sent,
			COUNT(*) FILTER (WHERE status = 'waitlisted') AS waitlisted_total,
			COUNT(*) FILTER (WHERE status = 'waitlisted' AND decision_email_sent_at IS NOT NULL) AS waitlisted_sent,
			COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_total,
			COUNT(*) FILTER (WHERE status = 'rejected' AND decision_email_sent_at IS NOT NULL) AS rejected_sent,
			COUNT(*) FILTER (WHERE status IN ('accepted', 'waitlisted', 'rejected')) AS announcement_total,
			COUNT(*) FILTER (WHERE status IN ('accepted', 'waitlisted', 'rejected') AND announcement_email_sent_at IS NOT NULL) AS announcement_sent
		FROM applications
	`

	var stats DecisionEmailStats
	err := s.db.QueryRowContext(ctx, query).Scan(
		&stats.Accepted.Total, &stats.Accepted.Sent,
		&stats.Waitlisted.Total, &stats.Waitlisted.Sent,
		&stats.Rejected.Total, &stats.Rejected.Sent,
		&stats.Announcement.Total, &stats.Announcement.Sent,
	)
	if err != nil {
		return nil, err
	}

	for _, counts := range []*EmailSendCounts{
		&stats.Accepted, &stats.Waitlisted, &stats.Rejected, &stats.Announcement,
	} {
		counts.Pending = counts.Total - counts.Sent
	}

	return &stats, nil
}
