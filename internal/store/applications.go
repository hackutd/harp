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

	"github.com/lib/pq"
)

type ApplicationStatus string

const (
	StatusDraft      ApplicationStatus = "draft"
	StatusSubmitted  ApplicationStatus = "submitted"
	StatusAccepted   ApplicationStatus = "accepted"
	StatusRejected   ApplicationStatus = "rejected"
	StatusWaitlisted ApplicationStatus = "waitlisted"
)

type DietaryRestriction string

const (
	DietaryVegan      DietaryRestriction = "vegan"
	DietaryVegetarian DietaryRestriction = "vegetarian"
	DietaryHalal      DietaryRestriction = "halal"
	DietaryNuts       DietaryRestriction = "nuts"
	DietaryFish       DietaryRestriction = "fish"
	DietaryWheat      DietaryRestriction = "wheat"
	DietaryDairy      DietaryRestriction = "dairy"
	DietaryEggs       DietaryRestriction = "eggs"
	DietaryNoBeef     DietaryRestriction = "no_beef"
	DietaryNoPork     DietaryRestriction = "no_pork"
)

// PaginationDirection for bidirectional cursor traversal
type PaginationDirection string

const (
	DirectionForward  PaginationDirection = "forward"
	DirectionBackward PaginationDirection = "backward"
)

// ApplicationCursor represents pagination cursor
type ApplicationCursor struct {
	CreatedAt time.Time `json:"c"`
	ID        string    `json:"i"`
}

// ApplicationListFilters for query filtering
type ApplicationListFilters struct {
	Status *ApplicationStatus
}

// ApplicationListItem is a lightweight view for admin listing
type ApplicationListItem struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Email       string            `json:"email"`
	Status      ApplicationStatus `json:"status"`
	FirstName   *string           `json:"first_name"`
	LastName    *string           `json:"last_name"`
	University  *string           `json:"university"`
	SubmittedAt *time.Time        `json:"submitted_at"`
	CreatedAt   time.Time         `json:"created_at"`
}

// ApplicationListResult contains paginated results
type ApplicationListResult struct {
	Applications []ApplicationListItem `json:"applications"`
	NextCursor   *string               `json:"next_cursor,omitempty"`
	PrevCursor   *string               `json:"prev_cursor,omitempty"`
	HasMore      bool                  `json:"has_more"`
}

// EncodeCursor creates a base64-encoded cursor string
func EncodeCursor(createdAt time.Time, id string) string {
	cursor := ApplicationCursor{CreatedAt: createdAt, ID: id}
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
	if cursor.ID == "" || cursor.CreatedAt.IsZero() {
		return nil, fmt.Errorf("invalid cursor: missing fields")
	}
	return &cursor, nil
}

type Application struct {
	ID     string            `json:"id"`
	UserID string            `json:"user_id"`
	Status ApplicationStatus `json:"status"`

	FirstName *string `json:"first_name" validate:"omitempty,min=1"`
	LastName  *string `json:"last_name" validate:"omitempty,min=1"`
	PhoneE164 *string `json:"phone_e164" validate:"omitempty,e164"`
	Age       *int16  `json:"age" validate:"omitempty,min=1,max=150"`

	CountryOfResidence *string `json:"country_of_residence" validate:"omitempty,min=1"`
	Gender             *string `json:"gender" validate:"omitempty,min=1"`
	Race               *string `json:"race" validate:"omitempty,min=1"`
	Ethnicity          *string `json:"ethnicity" validate:"omitempty,min=1"`

	University   *string `json:"university" validate:"omitempty,min=1"`
	Major        *string `json:"major" validate:"omitempty,min=1"`
	LevelOfStudy *string `json:"level_of_study" validate:"omitempty,min=1"`

	ShortAnswerResponses json.RawMessage `json:"short_answer_responses"`

	HackathonsAttendedCount *int16  `json:"hackathons_attended_count" validate:"omitempty,min=0"`
	SoftwareExperienceLevel *string `json:"software_experience_level" validate:"omitempty,min=1"`
	HeardAbout              *string `json:"heard_about" validate:"omitempty,min=1"`

	ShirtSize           *string  `json:"shirt_size" validate:"omitempty,min=1"`
	DietaryRestrictions []string `json:"dietary_restrictions"`
	Accommodations      *string  `json:"accommodations"`

	Github   *string `json:"github" validate:"omitempty,url"`
	LinkedIn *string `json:"linkedin" validate:"omitempty,url"`
	Website  *string `json:"website" validate:"omitempty,url"`

	AckApplication bool `json:"ack_application"`
	AckMLHCOC      bool `json:"ack_mlh_coc"`
	AckMLHPrivacy  bool `json:"ack_mlh_privacy"`
	OptInMLHEmails bool `json:"opt_in_mlh_emails"`

	SubmittedAt *time.Time `json:"submitted_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type ApplicationsStore struct {
	db *sql.DB
}

func (s *ApplicationsStore) GetByID(ctx context.Context, id string) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, user_id, status,
			first_name, last_name, phone_e164, age,
			country_of_residence, gender, race, ethnicity,
			university, major, level_of_study,
			short_answer_responses,
			hackathons_attended_count, software_experience_level, heard_about,
			shirt_size, dietary_restrictions, accommodations,
			github, linkedin, website,
			ack_application, ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
			submitted_at, created_at, updated_at
		FROM applications
		WHERE id = $1
	`

	var app Application
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&app.ID, &app.UserID, &app.Status,
		&app.FirstName, &app.LastName, &app.PhoneE164, &app.Age,
		&app.CountryOfResidence, &app.Gender, &app.Race, &app.Ethnicity,
		&app.University, &app.Major, &app.LevelOfStudy,
		&app.ShortAnswerResponses,
		&app.HackathonsAttendedCount, &app.SoftwareExperienceLevel, &app.HeardAbout,
		&app.ShirtSize, pq.Array(&app.DietaryRestrictions), &app.Accommodations,
		&app.Github, &app.LinkedIn, &app.Website,
		&app.AckApplication, &app.AckMLHCOC, &app.AckMLHPrivacy, &app.OptInMLHEmails,
		&app.SubmittedAt, &app.CreatedAt, &app.UpdatedAt,
	)
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

	query := `
		SELECT id, user_id, status,
			first_name, last_name, phone_e164, age,
			country_of_residence, gender, race, ethnicity,
			university, major, level_of_study,
			short_answer_responses,
			hackathons_attended_count, software_experience_level, heard_about,
			shirt_size, dietary_restrictions, accommodations,
			github, linkedin, website,
			ack_application, ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
			submitted_at, created_at, updated_at
		FROM applications
		WHERE user_id = $1
	`

	var app Application
	err := s.db.QueryRowContext(ctx, query, userID).Scan(
		&app.ID, &app.UserID, &app.Status,
		&app.FirstName, &app.LastName, &app.PhoneE164, &app.Age,
		&app.CountryOfResidence, &app.Gender, &app.Race, &app.Ethnicity,
		&app.University, &app.Major, &app.LevelOfStudy,
		&app.ShortAnswerResponses,
		&app.HackathonsAttendedCount, &app.SoftwareExperienceLevel, &app.HeardAbout,
		&app.ShirtSize, pq.Array(&app.DietaryRestrictions), &app.Accommodations,
		&app.Github, &app.LinkedIn, &app.Website,
		&app.AckApplication, &app.AckMLHCOC, &app.AckMLHPrivacy, &app.OptInMLHEmails,
		&app.SubmittedAt, &app.CreatedAt, &app.UpdatedAt,
	)
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
		RETURNING id, status, short_answer_responses, dietary_restrictions,
				  ack_application, ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
				  created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.UserID).Scan(
		&app.ID, &app.Status, &app.ShortAnswerResponses, pq.Array(&app.DietaryRestrictions),
		&app.AckApplication, &app.AckMLHCOC, &app.AckMLHPrivacy, &app.OptInMLHEmails,
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
			first_name = $2,
			last_name = $3,
			phone_e164 = $4,
			age = $5,
			country_of_residence = $6,
			gender = $7,
			race = $8,
			ethnicity = $9,
			university = $10,
			major = $11,
			level_of_study = $12,
			short_answer_responses = $13,
			hackathons_attended_count = $14,
			software_experience_level = $15,
			heard_about = $16,
			shirt_size = $17,
			dietary_restrictions = $18,
			accommodations = $19,
			github = $20,
			linkedin = $21,
			website = $22,
			ack_application = $23,
			ack_mlh_coc = $24,
			ack_mlh_privacy = $25,
			opt_in_mlh_emails = $26
		WHERE id = $1
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		app.ID,
		app.FirstName, app.LastName, app.PhoneE164, app.Age,
		app.CountryOfResidence, app.Gender, app.Race, app.Ethnicity,
		app.University, app.Major, app.LevelOfStudy,
		app.ShortAnswerResponses,
		app.HackathonsAttendedCount, app.SoftwareExperienceLevel, app.HeardAbout,
		app.ShirtSize, pq.Array(app.DietaryRestrictions), app.Accommodations,
		app.Github, app.LinkedIn, app.Website,
		app.AckApplication, app.AckMLHCOC, app.AckMLHPrivacy, app.OptInMLHEmails,
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

// Cursor pagination for applciations
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

	var cursorTime *time.Time
	var cursorID *string
	if cursor != nil {
		cursorTime = &cursor.CreatedAt
		cursorID = &cursor.ID
	}

	// Forward query (default): ORDER BY created_at DESC, id DESC
	// Backward query: ORDER BY created_at ASC, id ASC (then reverse results)
	var query string
	if direction == DirectionBackward && cursor != nil {
		query = `
			SELECT a.id, a.user_id, u.email, a.status,
			       a.first_name, a.last_name, a.university,
			       a.submitted_at, a.created_at
			FROM applications a
			INNER JOIN users u ON a.user_id = u.id
			WHERE ($1::application_status IS NULL OR a.status = $1)
			  AND (a.created_at, a.id) > ($2, $3::uuid)
			ORDER BY a.created_at ASC, a.id ASC
			LIMIT $4`
	} else {
		query = `
			SELECT a.id, a.user_id, u.email, a.status,
			       a.first_name, a.last_name, a.university,
			       a.submitted_at, a.created_at
			FROM applications a
			INNER JOIN users u ON a.user_id = u.id
			WHERE ($1::application_status IS NULL OR a.status = $1)
			  AND ($2::timestamptz IS NULL OR (a.created_at, a.id) < ($2, $3::uuid))
			ORDER BY a.created_at DESC, a.id DESC
			LIMIT $4`
	}

	// Fetch limit+1 to determine hasMore
	queryLimit := limit + 1

	var statusParam interface{}
	if filters.Status != nil {
		statusParam = *filters.Status
	}

	rows, err := s.db.QueryContext(ctx, query, statusParam, cursorTime, cursorID, queryLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ApplicationListItem, 0, limit)
	for rows.Next() {
		var item ApplicationListItem
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Email, &item.Status,
			&item.FirstName, &item.LastName, &item.University,
			&item.SubmittedAt, &item.CreatedAt,
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
		//  Going Backwards
		if direction == DirectionBackward {
			lastItem := items[len(items)-1]
			nc := EncodeCursor(lastItem.CreatedAt, lastItem.ID)
			result.NextCursor = &nc

			// Prev cursor only if there are more items
			if hasMore {
				firstItem := items[0]
				pc := EncodeCursor(firstItem.CreatedAt, firstItem.ID)
				result.PrevCursor = &pc
			}
		} else {
			// Next cursor (default)
			if hasMore {
				lastItem := items[len(items)-1]
				nc := EncodeCursor(lastItem.CreatedAt, lastItem.ID)
				result.NextCursor = &nc
			}

			// Prev cursor
			if cursor != nil {
				firstItem := items[0]
				pc := EncodeCursor(firstItem.CreatedAt, firstItem.ID)
				result.PrevCursor = &pc
			}
		}
	}

	return result, nil
}
