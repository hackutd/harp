package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "github.com/lib/pq"
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
	}
	Settings interface {
		GetShortAnswerQuestions(ctx context.Context) ([]ShortAnswerQuestion, error)
		UpdateShortAnswerQuestions(ctx context.Context, questions []ShortAnswerQuestion) error
		GetReviewsPerApplication(ctx context.Context) (int, error)
		SetReviewsPerApplication(ctx context.Context, value int) error
	}
}

func NewStorage(db *sql.DB) Storage {
	return Storage{
		Users:       &UsersStore{db: db},
		Application: &ApplicationsStore{db: db},
		Settings:    &SettingsStore{db: db},
	}
}
