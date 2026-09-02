package store

import (
	"context"
	"encoding/json"
	"time"

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

func (m *MockUsersStore) Search(ctx context.Context, query string, limit int, offset int) (*UserSearchResult, error) {
	args := m.Called(query, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*UserSearchResult), args.Error(1)
}

func (m *MockUsersStore) UpdateRole(ctx context.Context, userID string, role UserRole) (*User, error) {
	args := m.Called(userID, role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockUsersStore) Delete(ctx context.Context, userID string) (*DeletedUserPaths, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*DeletedUserPaths), args.Error(1)
}

func (m *MockUsersStore) GetByRole(ctx context.Context, role UserRole) ([]User, error) {
	args := m.Called(role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]User), args.Error(1)
}

func (m *MockUsersStore) ListUsers(ctx context.Context, filters UserListFilters, cursor *UserCursor, direction PaginationDirection, limit int) (*UserListResult, error) {
	args := m.Called(filters, cursor, direction, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*UserListResult), args.Error(1)
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

func (m *MockApplicationStore) Submit(ctx context.Context, app *Application, travelOptInFieldID string) error {
	args := m.Called(app, travelOptInFieldID)
	return args.Error(0)
}

func (m *MockApplicationStore) SubmitRSVP(ctx context.Context, app *Application) error {
	args := m.Called(app)
	return args.Error(0)
}

func (m *MockApplicationStore) SubmitTravelRSVP(ctx context.Context, app *Application) error {
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

func (m *MockApplicationStore) SetTravelStatus(ctx context.Context, id string, status TravelStatus, approvedAmountCents *int64) (*Application, error) {
	args := m.Called(id, status, approvedAmountCents)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Application), args.Error(1)
}

func (m *MockApplicationStore) GetFormOperationsStats(ctx context.Context) (*FormOperationsStats, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*FormOperationsStats), args.Error(1)
}

func (m *MockApplicationStore) ResetRSVP(ctx context.Context, id string) (*Application, []string, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	receipts, _ := args.Get(1).([]string)
	return args.Get(0).(*Application), receipts, args.Error(2)
}

func (m *MockApplicationStore) ResetTravelRSVP(ctx context.Context, id string) (*Application, []string, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	receipts, _ := args.Get(1).([]string)
	return args.Get(0).(*Application), receipts, args.Error(2)
}

func (m *MockApplicationStore) GetStatusByUserID(ctx context.Context, userID string) (ApplicationStatus, error) {
	args := m.Called(userID)
	return args.Get(0).(ApplicationStatus), args.Error(1)
}

func (m *MockApplicationStore) GetEmailsByStatus(ctx context.Context, status ApplicationStatus) ([]UserEmailInfo, error) {
	args := m.Called(status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]UserEmailInfo), args.Error(1)
}

func (m *MockApplicationStore) GetDecisionEmailRecipients(ctx context.Context, statuses []ApplicationStatus, kind DecisionEmailKind, onlyUnsent bool) ([]DecisionEmailRecipient, error) {
	args := m.Called(statuses, kind, onlyUnsent)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]DecisionEmailRecipient), args.Error(1)
}

func (m *MockApplicationStore) SetDecisionEmailSent(ctx context.Context, applicationIDs []string, kind DecisionEmailKind, sent bool) error {
	args := m.Called(applicationIDs, kind, sent)
	return args.Error(0)
}

func (m *MockApplicationStore) GetDecisionEmailStats(ctx context.Context) (*DecisionEmailStats, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*DecisionEmailStats), args.Error(1)
}

func (m *MockApplicationStore) SetMealGroup(ctx context.Context, id string, mealGroup string) (*string, error) {
	args := m.Called(id, mealGroup)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*string), args.Error(1)
}

func (m *MockApplicationStore) GetMealGroupByUserID(ctx context.Context, userID string) (*string, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*string), args.Error(1)
}

// mock implementation of the Settings interface
type MockSettingsStore struct {
	mock.Mock
}

func (m *MockSettingsStore) GetMany(ctx context.Context, keys ...string) (map[string]json.RawMessage, error) {
	args := m.Called(keys)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]json.RawMessage), args.Error(1)
}

func (m *MockSettingsStore) GetApplicationSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ApplicationSchemaField), args.Error(1)
}

func (m *MockSettingsStore) UpdateApplicationSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	args := m.Called(fields)
	return args.Error(0)
}

func (m *MockSettingsStore) GetRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ApplicationSchemaField), args.Error(1)
}

func (m *MockSettingsStore) UpdateRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	args := m.Called(fields)
	return args.Error(0)
}

func (m *MockSettingsStore) GetRSVPEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetRSVPEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) GetTravelRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ApplicationSchemaField), args.Error(1)
}

func (m *MockSettingsStore) UpdateTravelRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	args := m.Called(fields)
	return args.Error(0)
}

func (m *MockSettingsStore) GetTravelRSVPEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetTravelRSVPEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
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

func (m *MockSettingsStore) GetAllReviewAssignmentToggles(ctx context.Context) ([]ReviewAssignmentEntry, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ReviewAssignmentEntry), args.Error(1)
}

func (m *MockSettingsStore) GetReviewAssignmentToggle(ctx context.Context, superAdminID string) (bool, error) {
	args := m.Called(superAdminID)
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetReviewAssignmentToggle(ctx context.Context, superAdminID string, enabled bool) error {
	args := m.Called(superAdminID, enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) GetAdminScheduleEditEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetAdminScheduleEditEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) GetAdminSponsorEditEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetAdminSponsorEditEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) GetAdminFAQEditEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetAdminFAQEditEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) GetHackathonDateRange(ctx context.Context) (HackathonDateRange, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return HackathonDateRange{}, args.Error(1)
	}
	return args.Get(0).(HackathonDateRange), args.Error(1)
}

func (m *MockSettingsStore) SetHackathonDateRange(ctx context.Context, dateRange HackathonDateRange) error {
	args := m.Called(dateRange)
	return args.Error(0)
}

func (m *MockSettingsStore) GetHackerPackURL(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetHackerPackURL(ctx context.Context, url string) error {
	args := m.Called(url)
	return args.Error(0)
}

func (m *MockSettingsStore) GetPointsName(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) GetPointsEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetPointsEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

func (m *MockSettingsStore) SetPointsName(ctx context.Context, name string) error {
	args := m.Called(name)
	return args.Error(0)
}

func (m *MockSettingsStore) GetHackathonName(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetHackathonName(ctx context.Context, name string) error {
	args := m.Called(name)
	return args.Error(0)
}

func (m *MockSettingsStore) GetContactEmail(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetContactEmail(ctx context.Context, email string) error {
	args := m.Called(email)
	return args.Error(0)
}

func (m *MockSettingsStore) GetPrivacyPolicyURL(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetPrivacyPolicyURL(ctx context.Context, url string) error {
	args := m.Called(url)
	return args.Error(0)
}

func (m *MockSettingsStore) GetTermsURL(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetTermsURL(ctx context.Context, url string) error {
	args := m.Called(url)
	return args.Error(0)
}

func (m *MockSettingsStore) GetFromEmail(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetFromEmail(ctx context.Context, email string) error {
	args := m.Called(email)
	return args.Error(0)
}

func (m *MockSettingsStore) GetFromName(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetFromName(ctx context.Context, name string) error {
	args := m.Called(name)
	return args.Error(0)
}

func (m *MockSettingsStore) GetApplicationDueDate(ctx context.Context) (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSettingsStore) SetApplicationDueDate(ctx context.Context, date string) error {
	args := m.Called(date)
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

func (m *MockSettingsStore) GetMealGroups(ctx context.Context) ([]string, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockSettingsStore) SetMealGroups(ctx context.Context, groups []string) error {
	args := m.Called(groups)
	return args.Error(0)
}

func (m *MockSettingsStore) GetMealGroupStats(ctx context.Context) (map[string]int, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]int), args.Error(1)
}

func (m *MockSettingsStore) GetApplicationsEnabled(ctx context.Context) (bool, error) {
	args := m.Called()
	return args.Bool(0), args.Error(1)
}

func (m *MockSettingsStore) SetApplicationsEnabled(ctx context.Context, enabled bool) error {
	args := m.Called(enabled)
	return args.Error(0)
}

// MockHackathonStore is a mock implementation of the Hackathon interface
type MockHackathonStore struct {
	mock.Mock
}

func (m *MockHackathonStore) Reset(ctx context.Context, opts ResetOptions) (*ResetPaths, error) {
	args := m.Called(opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ResetPaths), args.Error(1)
}

// MockApplicationReviewsStore is a mock implementation of the ApplicationReviews interface
type MockApplicationReviewsStore struct {
	mock.Mock
}

func (m *MockApplicationReviewsStore) SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, travelVote *bool, notes *string) (*ApplicationReview, error) {
	args := m.Called(reviewID, adminID, vote, travelVote, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ApplicationReview), args.Error(1)
}

func (m *MockApplicationReviewsStore) GetTravelStatusByReviewID(ctx context.Context, reviewID string, adminID string) (TravelStatus, error) {
	args := m.Called(reviewID, adminID)
	return args.Get(0).(TravelStatus), args.Error(1)
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

func (m *MockApplicationReviewsStore) SetAIPercent(ctx context.Context, applicationID string, adminID string, percent int16) error {
	args := m.Called(applicationID, adminID, percent)
	return args.Error(0)
}

// MockScansStore is a mock implementation of the Scans interface
type MockScansStore struct {
	mock.Mock
}

func (m *MockScansStore) Create(ctx context.Context, scan *Scan) error {
	args := m.Called(scan)
	return args.Error(0)
}

func (m *MockScansStore) CreatePurchase(ctx context.Context, scan *Scan) (int, error) {
	args := m.Called(scan)
	return args.Int(0), args.Error(1)
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

func (m *MockScansStore) GetTotalPointsByUserID(ctx context.Context, userID string) (int, error) {
	args := m.Called(userID)
	return args.Int(0), args.Error(1)
}

func (m *MockScansStore) RebalanceStats(ctx context.Context) ([]ScanStat, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScanStat), args.Error(1)
}

// MockScheduleStore is a mock implementation of the Schedule interface
type MockScheduleStore struct {
	mock.Mock
}

func (m *MockScheduleStore) List(ctx context.Context) ([]ScheduleItem, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScheduleItem), args.Error(1)
}

func (m *MockScheduleStore) Create(ctx context.Context, item *ScheduleItem) error {
	args := m.Called(item)
	return args.Error(0)
}

func (m *MockScheduleStore) Update(ctx context.Context, item *ScheduleItem) error {
	args := m.Called(item)
	return args.Error(0)
}

func (m *MockScheduleStore) Delete(ctx context.Context, id string) error {
	args := m.Called(id)
	return args.Error(0)
}

// MockSponsorsStore is a mock implementation of the Sponsors interface
type MockSponsorsStore struct {
	mock.Mock
}

func (m *MockSponsorsStore) List(ctx context.Context) ([]Sponsor, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Sponsor), args.Error(1)
}

func (m *MockSponsorsStore) Create(ctx context.Context, sponsor *Sponsor) error {
	args := m.Called(sponsor)
	return args.Error(0)
}

func (m *MockSponsorsStore) Update(ctx context.Context, sponsor *Sponsor) error {
	args := m.Called(sponsor)
	return args.Error(0)
}

func (m *MockSponsorsStore) Delete(ctx context.Context, id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockSponsorsStore) GetByID(ctx context.Context, id string) (*Sponsor, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Sponsor), args.Error(1)
}

func (m *MockSponsorsStore) UpdateLogo(ctx context.Context, id string, logoData string, logoContentType string) error {
	args := m.Called(id, logoData, logoContentType)
	return args.Error(0)
}

// MockFAQsStore is a mock implementation of the FAQs interface
type MockFAQsStore struct {
	mock.Mock
}

func (m *MockFAQsStore) List(ctx context.Context) ([]FAQ, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]FAQ), args.Error(1)
}

func (m *MockFAQsStore) Create(ctx context.Context, faq *FAQ) error {
	args := m.Called(faq)
	return args.Error(0)
}

func (m *MockFAQsStore) Update(ctx context.Context, faq *FAQ) error {
	args := m.Called(faq)
	return args.Error(0)
}

func (m *MockFAQsStore) Delete(ctx context.Context, id string) error {
	args := m.Called(id)
	return args.Error(0)
}

// MockPushSubscriptionsStore is a mock implementation of the PushSubscriptions interface
type MockPushSubscriptionsStore struct {
	mock.Mock
}

func (m *MockPushSubscriptionsStore) Upsert(ctx context.Context, sub *PushSubscription) error {
	args := m.Called(sub)
	return args.Error(0)
}

func (m *MockPushSubscriptionsStore) DeleteByEndpoint(ctx context.Context, userID, endpoint string) error {
	args := m.Called(userID, endpoint)
	return args.Error(0)
}

func (m *MockPushSubscriptionsStore) DeleteByEndpointAdmin(ctx context.Context, endpoint string) error {
	args := m.Called(endpoint)
	return args.Error(0)
}

func (m *MockPushSubscriptionsStore) ListByRole(ctx context.Context, role *UserRole) ([]PushSubscription, error) {
	args := m.Called(role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]PushSubscription), args.Error(1)
}

// MockScheduledNotificationsStore is a mock implementation of the ScheduledNotifications interface
type MockScheduledNotificationsStore struct {
	mock.Mock
}

func (m *MockScheduledNotificationsStore) Create(ctx context.Context, n *ScheduledNotification) error {
	args := m.Called(n)
	return args.Error(0)
}

func (m *MockScheduledNotificationsStore) GetByID(ctx context.Context, id string) (*ScheduledNotification, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ScheduledNotification), args.Error(1)
}

func (m *MockScheduledNotificationsStore) List(ctx context.Context) ([]ScheduledNotification, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScheduledNotification), args.Error(1)
}

func (m *MockScheduledNotificationsStore) ListSentForRole(ctx context.Context, role UserRole, limit int) ([]ScheduledNotification, error) {
	args := m.Called(role, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScheduledNotification), args.Error(1)
}

func (m *MockScheduledNotificationsStore) Update(ctx context.Context, n *ScheduledNotification) error {
	args := m.Called(n)
	return args.Error(0)
}

func (m *MockScheduledNotificationsStore) Delete(ctx context.Context, id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockScheduledNotificationsStore) ClaimDue(ctx context.Context, now time.Time, limit int) ([]ScheduledNotification, error) {
	args := m.Called(now, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]ScheduledNotification), args.Error(1)
}

func (m *MockScheduledNotificationsStore) MarkSent(ctx context.Context, id string, recipientCount int) error {
	args := m.Called(id, recipientCount)
	return args.Error(0)
}

func (m *MockScheduledNotificationsStore) GenerateFromSchedule(ctx context.Context, lead time.Duration, targetRole *UserRole, createdBy string, now time.Time) (*ScheduleNotificationGenerationResult, error) {
	args := m.Called(lead, targetRole, createdBy, now)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ScheduleNotificationGenerationResult), args.Error(1)
}

// MockWalkInsStore is a mock implementation of the WalkIns interface
type MockWalkInsStore struct {
	mock.Mock
}

func (m *MockWalkInsStore) Enqueue(ctx context.Context, userID string) (bool, int, error) {
	args := m.Called(userID)
	return args.Bool(0), args.Int(1), args.Error(2)
}

func (m *MockWalkInsStore) PromoteNext(ctx context.Context, count int, promotedBy string) ([]User, error) {
	args := m.Called(count, promotedBy)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]User), args.Error(1)
}

func (m *MockWalkInsStore) QueueDepth(ctx context.Context) (int, int, error) {
	args := m.Called()
	return args.Int(0), args.Int(1), args.Error(2)
}

func (m *MockWalkInsStore) List(ctx context.Context) ([]WalkIn, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]WalkIn), args.Error(1)
}

// returns a Storage with all mock implementations
func NewMockStore() Storage {
	return Storage{
		Users:                  &MockUsersStore{},
		Application:            &MockApplicationStore{},
		Settings:               &MockSettingsStore{},
		Hackathon:              &MockHackathonStore{},
		ApplicationReviews:     &MockApplicationReviewsStore{},
		Scans:                  &MockScansStore{},
		Schedule:               &MockScheduleStore{},
		Sponsors:               &MockSponsorsStore{},
		FAQs:                   &MockFAQsStore{},
		PushSubscriptions:      &MockPushSubscriptionsStore{},
		ScheduledNotifications: &MockScheduledNotificationsStore{},
		WalkIns:                &MockWalkInsStore{},
	}
}
