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
	}
	Application interface {
		GetByUserID(ctx context.Context, userID string) (*Application, error)
		Create(ctx context.Context, app *Application) error
	}
}

func NewStorage(db *sql.DB) Storage {
	return Storage{
		Users: &UsersStore{db: db},
		Application: &ApplicationsStore{db: db},
}
}
