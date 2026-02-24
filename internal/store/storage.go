package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	ErrNotFound          = errors.New("resource not found")
	ErrConflict          = errors.New("resource already exists")
	QueryTimeoutDuration = time.Second * 5
)

type Storage struct {
	Users interface {
		GetBySuperTokensID(ctx context.Context, supertokensUserID string) (*User, error)
		GetByID(ctx context.Context, id string) (*User, error)
		GetByEmail(ctx context.Context, email string) (*User, error)
		Create(ctx context.Context, user *User) error
		UpdateProfilePicture(ctx context.Context, supertokensUserID string, pictureURL *string) error
	}
	Application interface {
		GetByUserID(ctx context.Context, userID string) (*Application, error)
		GetByID(ctx context.Context, id string) (*Application, error)
		Create(ctx context.Context, app *Application) error
		Update(ctx context.Context, app *Application) error
		Submit(ctx context.Context, app *Application) error
		List(ctx context.Context, filters ApplicationListFilters, cursor *ApplicationCursor, direction PaginationDirection, limit int) (*ApplicationListResult, error)
		GetStats(ctx context.Context) (*ApplicationStats, error)
		SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error)
		GetEmailsByStatus(ctx context.Context, status ApplicationStatus) ([]UserEmailInfo, error)
	}
	Settings interface {
		GetShortAnswerQuestions(ctx context.Context) ([]ShortAnswerQuestion, error)
		UpdateShortAnswerQuestions(ctx context.Context, questions []ShortAnswerQuestion) error
		GetReviewsPerApplication(ctx context.Context) (int, error)
		SetReviewsPerApplication(ctx context.Context, value int) error
		GetScanTypes(ctx context.Context) ([]ScanType, error)
		UpdateScanTypes(ctx context.Context, scanTypes []ScanType) error
		GetScanStats(ctx context.Context) (map[string]int, error)
	}
	Scans interface {
		Create(ctx context.Context, scan *Scan) error
		GetByUserID(ctx context.Context, userID string) ([]Scan, error)
		GetStats(ctx context.Context) ([]ScanStat, error)
		HasCheckIn(ctx context.Context, userID string, checkInTypes []string) (bool, error)
	}
	ApplicationReviews interface {
		SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, notes *string) (*ApplicationReview, error)
		GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error)
		GetCompletedByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error)
		GetNotesByApplicationID(ctx context.Context, applicationID string) ([]ReviewNote, error)
		BatchAssign(ctx context.Context, reviewsPerApp int) (*BatchAssignmentResult, error)
		AssignNextForAdmin(ctx context.Context, adminID string, reviewsPerApp int) (*ApplicationReview, error)
	}
}

func NewStorage(db *sql.DB) Storage {
	return Storage{
		Users:              &UsersStore{db: db},
		Application:        &ApplicationsStore{db: db},
		Settings:           &SettingsStore{db: db},
		ApplicationReviews: &ApplicationReviewsStore{db: db},
		Scans:              &ScansStore{db: db},
	}
}
