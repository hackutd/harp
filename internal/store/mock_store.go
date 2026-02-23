package store

import (
	"context"

	"github.com/stretchr/testify/mock"
)

// mock implementation of the Users interface
type MockUsersStore struct {
	mock.Mock
}

func (m *MockUsersStore) GetBySuperTokensID(ctx context.Context, supertokensUserID string) (*User, error) {
	args := m.Called(supertokensUserID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockUsersStore) GetByID(ctx context.Context, id string) (*User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockUsersStore) GetByEmail(ctx context.Context, email string) (*User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockUsersStore) Create(ctx context.Context, user *User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUsersStore) UpdateProfilePicture(ctx context.Context, supertokensUserID string, pictureURL *string) error {
	args := m.Called(supertokensUserID, pictureURL)
	return args.Error(0)
}

// mock implementation of the Application interface
type MockApplicationStore struct {
	mock.Mock
}

func (m *MockApplicationStore) GetByUserID(ctx context.Context, userID string) (*Application, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Application), args.Error(1)
}

func (m *MockApplicationStore) GetByID(ctx context.Context, id string) (*Application, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Application), args.Error(1)
}

func (m *MockApplicationStore) Create(ctx context.Context, app *Application) error {
	args := m.Called(app)
	return args.Error(0)
}

func (m *MockApplicationStore) Update(ctx context.Context, app *Application) error {
	args := m.Called(app)
	return args.Error(0)
}

func (m *MockApplicationStore) Submit(ctx context.Context, app *Application) error {
	args := m.Called(app)
	return args.Error(0)
}

func (m *MockApplicationStore) List(ctx context.Context, filters ApplicationListFilters, cursor *ApplicationCursor, direction PaginationDirection, limit int) (*ApplicationListResult, error) {
	args := m.Called(filters, cursor, direction, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ApplicationListResult), args.Error(1)
}

func (m *MockApplicationStore) GetStats(ctx context.Context) (*ApplicationStats, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ApplicationStats), args.Error(1)
}

func (m *MockApplicationStore) SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error) {
	args := m.Called(id, status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Application), args.Error(1)
}

func (m *MockApplicationStore) GetEmailsByStatus(ctx context.Context, status ApplicationStatus) ([]string, error) {
	args := m.Called(status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

// mock implementation of the Settings interface
type MockSettingsStore struct {
	mock.Mock
}

func (m *MockSettingsStore) GetShortAnswerQuestions(ctx context.Context) ([]ShortAnswerQuestion, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ShortAnswerQuestion), args.Error(1)
}

func (m *MockSettingsStore) UpdateShortAnswerQuestions(ctx context.Context, questions []ShortAnswerQuestion) error {
	args := m.Called(questions)
	return args.Error(0)
}

func (m *MockSettingsStore) GetReviewsPerApplication(ctx context.Context) (int, error) {
	args := m.Called()
	return args.Int(0), args.Error(1)
}

func (m *MockSettingsStore) SetReviewsPerApplication(ctx context.Context, value int) error {
	args := m.Called(value)
	return args.Error(0)
}

func (m *MockSettingsStore) GetScanTypes(ctx context.Context) ([]ScanType, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScanType), args.Error(1)
}

func (m *MockSettingsStore) UpdateScanTypes(ctx context.Context, scanTypes []ScanType) error {
	args := m.Called(scanTypes)
	return args.Error(0)
}

func (m *MockSettingsStore) GetScanStats(ctx context.Context) (map[string]int, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]int), args.Error(1)
}

// MockApplicationReviewsStore is a mock implementation of the ApplicationReviews interface
type MockApplicationReviewsStore struct {
	mock.Mock
}

func (m *MockApplicationReviewsStore) SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, notes *string) (*ApplicationReview, error) {
	args := m.Called(reviewID, adminID, vote, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ApplicationReview), args.Error(1)
}

func (m *MockApplicationReviewsStore) GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
	args := m.Called(adminID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ApplicationReviewWithDetails), args.Error(1)
}

func (m *MockApplicationReviewsStore) GetCompletedByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error) {
	args := m.Called(adminID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ApplicationReviewWithDetails), args.Error(1)
}

func (m *MockApplicationReviewsStore) GetNotesByApplicationID(ctx context.Context, applicationID string) ([]ReviewNote, error) {
	args := m.Called(applicationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ReviewNote), args.Error(1)
}

func (m *MockApplicationReviewsStore) BatchAssign(ctx context.Context, reviewsPerApp int) (*BatchAssignmentResult, error) {
	args := m.Called(reviewsPerApp)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*BatchAssignmentResult), args.Error(1)
}

func (m *MockApplicationReviewsStore) AssignNextForAdmin(ctx context.Context, adminID string, reviewsPerApp int) (*ApplicationReview, error) {
	args := m.Called(adminID, reviewsPerApp)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ApplicationReview), args.Error(1)
}

// MockScansStore is a mock implementation of the Scans interface
type MockScansStore struct {
	mock.Mock
}

func (m *MockScansStore) Create(ctx context.Context, scan *Scan) error {
	args := m.Called(scan)
	return args.Error(0)
}

func (m *MockScansStore) GetByUserID(ctx context.Context, userID string) ([]Scan, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Scan), args.Error(1)
}

func (m *MockScansStore) GetStats(ctx context.Context) ([]ScanStat, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScanStat), args.Error(1)
}

func (m *MockScansStore) HasCheckIn(ctx context.Context, userID string, checkInTypes []string) (bool, error) {
	args := m.Called(userID, checkInTypes)
	return args.Bool(0), args.Error(1)
}

// returns a Storage with all mock implementations
func NewMockStore() Storage {
	return Storage{
		Users:              &MockUsersStore{},
		Application:        &MockApplicationStore{},
		Settings:           &MockSettingsStore{},
		ApplicationReviews: &MockApplicationReviewsStore{},
		Scans:              &MockScansStore{},
	}
}
