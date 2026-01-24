package store

import (
	"context"
	"database/sql"
	"errors"
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

	WhyAttend           *string `json:"why_attend" validate:"omitempty,min=1"`
	HackathonsLearned   *string `json:"hackathons_learned" validate:"omitempty,min=1"`
	FirstHackathonGoals *string `json:"first_hackathon_goals" validate:"omitempty,min=1"`
	LookingForward      *string `json:"looking_forward" validate:"omitempty,min=1"`

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

func (s *ApplicationsStore) GetByUserID(ctx context.Context, userID string) (*Application, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, user_id, status,
			first_name, last_name, phone_e164, age,
			country_of_residence, gender, race, ethnicity,
			university, major, level_of_study,
			why_attend, hackathons_learned, first_hackathon_goals, looking_forward,
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
		&app.WhyAttend, &app.HackathonsLearned, &app.FirstHackathonGoals, &app.LookingForward,
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
		RETURNING id, status, dietary_restrictions, ack_application, ack_mlh_coc,
				  ack_mlh_privacy, opt_in_mlh_emails, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, app.UserID).Scan(
		&app.ID, &app.Status, pq.Array(&app.DietaryRestrictions),
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
			why_attend = $13,
			hackathons_learned = $14,
			first_hackathon_goals = $15,
			looking_forward = $16,
			hackathons_attended_count = $17,
			software_experience_level = $18,
			heard_about = $19,
			shirt_size = $20,
			dietary_restrictions = $21,
			accommodations = $22,
			github = $23,
			linkedin = $24,
			website = $25,
			ack_application = $26,
			ack_mlh_coc = $27,
			ack_mlh_privacy = $28,
			opt_in_mlh_emails = $29
		WHERE id = $1
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		app.ID,
		app.FirstName, app.LastName, app.PhoneE164, app.Age,
		app.CountryOfResidence, app.Gender, app.Race, app.Ethnicity,
		app.University, app.Major, app.LevelOfStudy,
		app.WhyAttend, app.HackathonsLearned, app.FirstHackathonGoals, app.LookingForward,
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
