package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	ErrNotFound           = errors.New("resource not found")
	ErrConflict           = errors.New("resource already exists")
	ErrInsufficientPoints = errors.New("insufficient points")
	QueryTimeoutDuration  = time.Second * 5
)

// Travel decision conflicts. Each wraps ErrConflict so existing callers that
// only check for a conflict keep working, while handlers that care can report
// exactly why the decision was refused.
var (
	// ErrTravelNotRequested is returned when the applicant never opted into
	// travel reimbursement, so there is nothing to decide.
	ErrTravelNotRequested = fmt.Errorf("%w: applicant did not request travel reimbursement", ErrConflict)
	// ErrTravelStatusNotDecidable is returned when the application is in a
	// status that cannot carry a travel decision (draft or rejected).
	ErrTravelStatusNotDecidable = fmt.Errorf("%w: application status does not allow a travel decision", ErrConflict)
	// ErrTravelRSVPSubmitted is returned when the hacker has already submitted
	// their travel RSVP, which pins the travel status until it is reset.
	ErrTravelRSVPSubmitted = fmt.Errorf("%w: travel rsvp already submitted", ErrConflict)
)

type Storage struct {
	Users interface {
		GetBySuperTokensID(ctx context.Context, supertokensUserID string) (*User, error)
		GetByID(ctx context.Context, id string) (*User, error)
		GetByEmail(ctx context.Context, email string) (*User, error)
		Create(ctx context.Context, user *User) error
		UpdateProfilePicture(ctx context.Context, supertokensUserID string, pictureURL *string) error
		Search(ctx context.Context, query string, limit int, offset int) (*UserSearchResult, error)
		UpdateRole(ctx context.Context, userID string, role UserRole) (*User, error)
		GetByRole(ctx context.Context, role UserRole) ([]User, error)
		Delete(ctx context.Context, userID string) (*DeletedUserPaths, error)
		ListUsers(ctx context.Context, filters UserListFilters, cursor *UserCursor, direction PaginationDirection, limit int) (*UserListResult, error)
	}
	Application interface {
		GetByUserID(ctx context.Context, userID string) (*Application, error)
		GetByID(ctx context.Context, id string) (*Application, error)
		GetStatusByUserID(ctx context.Context, userID string) (ApplicationStatus, error)
		Create(ctx context.Context, app *Application) error
		Update(ctx context.Context, app *Application) error
		Submit(ctx context.Context, app *Application, travelOptInFieldID string) error
		SubmitRSVP(ctx context.Context, app *Application) error
		SubmitTravelRSVP(ctx context.Context, app *Application) error
		List(ctx context.Context, filters ApplicationListFilters, cursor *ApplicationCursor, direction PaginationDirection, limit int) (*ApplicationListResult, error)
		GetStats(ctx context.Context) (*ApplicationStats, error)
		SetStatus(ctx context.Context, id string, status ApplicationStatus) (*Application, error)
		SetTravelStatus(ctx context.Context, id string, status TravelStatus, approvedAmountCents *int64) (*Application, error)
		GetFormOperationsStats(ctx context.Context) (*FormOperationsStats, error)
		ResetRSVP(ctx context.Context, id string) (*Application, []string, error)
		ResetTravelRSVP(ctx context.Context, id string) (*Application, []string, error)
		GetEmailsByStatus(ctx context.Context, status ApplicationStatus) ([]UserEmailInfo, error)
		GetDecisionEmailRecipients(ctx context.Context, statuses []ApplicationStatus, kind DecisionEmailKind, onlyUnsent bool) ([]DecisionEmailRecipient, error)
		SetDecisionEmailSent(ctx context.Context, applicationIDs []string, kind DecisionEmailKind, sent bool) error
		GetDecisionEmailStats(ctx context.Context) (*DecisionEmailStats, error)
		SetMealGroup(ctx context.Context, id string, mealGroup string) (*string, error)
		GetMealGroupByUserID(ctx context.Context, userID string) (*string, error)
	}
	Settings interface {
		// GetMany reads several settings in one round trip and primes the
		// cache, so the typed getters that follow cost no further queries.
		GetMany(ctx context.Context, keys ...string) (map[string]json.RawMessage, error)
		GetApplicationSchema(ctx context.Context) ([]ApplicationSchemaField, error)
		UpdateApplicationSchema(ctx context.Context, fields []ApplicationSchemaField) error
		GetRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error)
		UpdateRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error
		GetRSVPEnabled(ctx context.Context) (bool, error)
		SetRSVPEnabled(ctx context.Context, enabled bool) error
		GetTravelRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error)
		UpdateTravelRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error
		GetTravelRSVPEnabled(ctx context.Context) (bool, error)
		SetTravelRSVPEnabled(ctx context.Context, enabled bool) error
		GetReviewsPerApplication(ctx context.Context) (int, error)
		SetReviewsPerApplication(ctx context.Context, value int) error
		GetAllReviewAssignmentToggles(ctx context.Context) ([]ReviewAssignmentEntry, error)
		GetReviewAssignmentToggle(ctx context.Context, superAdminID string) (bool, error)
		SetReviewAssignmentToggle(ctx context.Context, superAdminID string, enabled bool) error
		GetAdminScheduleEditEnabled(ctx context.Context) (bool, error)
		SetAdminScheduleEditEnabled(ctx context.Context, enabled bool) error
		GetHackathonDateRange(ctx context.Context) (HackathonDateRange, error)
		SetHackathonDateRange(ctx context.Context, dateRange HackathonDateRange) error
		GetHackerPackURL(ctx context.Context) (string, error)
		SetHackerPackURL(ctx context.Context, url string) error
		GetPointsName(ctx context.Context) (string, error)
		SetPointsName(ctx context.Context, name string) error
		GetPointsEnabled(ctx context.Context) (bool, error)
		SetPointsEnabled(ctx context.Context, enabled bool) error
		GetHackathonName(ctx context.Context) (string, error)
		SetHackathonName(ctx context.Context, name string) error
		GetContactEmail(ctx context.Context) (string, error)
		SetContactEmail(ctx context.Context, email string) error
		GetFromEmail(ctx context.Context) (string, error)
		SetFromEmail(ctx context.Context, email string) error
		GetFromName(ctx context.Context) (string, error)
		SetFromName(ctx context.Context, name string) error
		GetApplicationDueDate(ctx context.Context) (string, error)
		SetApplicationDueDate(ctx context.Context, date string) error
		GetPrivacyPolicyURL(ctx context.Context) (string, error)
		SetPrivacyPolicyURL(ctx context.Context, url string) error
		GetTermsURL(ctx context.Context) (string, error)
		SetTermsURL(ctx context.Context, url string) error
		GetScanTypes(ctx context.Context) ([]ScanType, error)
		UpdateScanTypes(ctx context.Context, scanTypes []ScanType) error
		GetScanStats(ctx context.Context) (map[string]int, error)
		GetMealGroups(ctx context.Context) ([]string, error)
		SetMealGroups(ctx context.Context, groups []string) error
		GetMealGroupStats(ctx context.Context) (map[string]int, error)
		GetApplicationsEnabled(ctx context.Context) (bool, error)
		SetApplicationsEnabled(ctx context.Context, enabled bool) error
		GetAdminSponsorEditEnabled(ctx context.Context) (bool, error)
		SetAdminSponsorEditEnabled(ctx context.Context, enabled bool) error
		GetAdminFAQEditEnabled(ctx context.Context) (bool, error)
		SetAdminFAQEditEnabled(ctx context.Context, enabled bool) error
	}
	Hackathon interface {
		Reset(ctx context.Context, opts ResetOptions) (*ResetPaths, error)
	}
	Scans interface {
		Create(ctx context.Context, scan *Scan) error
		CreatePurchase(ctx context.Context, scan *Scan) (int, error)
		GetByUserID(ctx context.Context, userID string) ([]Scan, error)
		GetStats(ctx context.Context) ([]ScanStat, error)
		HasCheckIn(ctx context.Context, userID string, checkInTypes []string) (bool, error)
		GetTotalPointsByUserID(ctx context.Context, userID string) (int, error)
		RebalanceStats(ctx context.Context) ([]ScanStat, error)
	}
	ApplicationReviews interface {
		SubmitVote(ctx context.Context, reviewID string, adminID string, vote ReviewVote, travelVote *bool, notes *string) (*ApplicationReview, error)
		GetTravelStatusByReviewID(ctx context.Context, reviewID string, adminID string) (TravelStatus, error)
		GetPendingByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error)
		GetCompletedByAdminID(ctx context.Context, adminID string) ([]ApplicationReviewWithDetails, error)
		GetNotesByApplicationID(ctx context.Context, applicationID string) ([]ReviewNote, error)
		BatchAssign(ctx context.Context, reviewsPerApp int) (*BatchAssignmentResult, error)
		AssignNextForAdmin(ctx context.Context, adminID string, reviewsPerApp int) (*ApplicationReview, error)
		SetAIPercent(ctx context.Context, applicationID string, adminID string, percent int16) error
	}
	Schedule interface {
		List(ctx context.Context) ([]ScheduleItem, error)
		Create(ctx context.Context, item *ScheduleItem) error
		Update(ctx context.Context, item *ScheduleItem) error
		Delete(ctx context.Context, id string) error
	}
	Sponsors interface {
		List(ctx context.Context) ([]Sponsor, error)
		Create(ctx context.Context, sponsor *Sponsor) error
		Update(ctx context.Context, sponsor *Sponsor) error
		Delete(ctx context.Context, id string) error
		GetByID(ctx context.Context, id string) (*Sponsor, error)
		UpdateLogo(ctx context.Context, id string, logoData string, logoContentType string) error
	}
	FAQs interface {
		List(ctx context.Context) ([]FAQ, error)
		Create(ctx context.Context, faq *FAQ) error
		Update(ctx context.Context, faq *FAQ) error
		Delete(ctx context.Context, id string) error
	}
	PushSubscriptions interface {
		Upsert(ctx context.Context, sub *PushSubscription) error
		DeleteByEndpoint(ctx context.Context, userID, endpoint string) error
		DeleteByEndpointAdmin(ctx context.Context, endpoint string) error
		ListByRole(ctx context.Context, role *UserRole) ([]PushSubscription, error)
	}
	ScheduledNotifications interface {
		Create(ctx context.Context, n *ScheduledNotification) error
		GetByID(ctx context.Context, id string) (*ScheduledNotification, error)
		List(ctx context.Context) ([]ScheduledNotification, error)
		ListSentForRole(ctx context.Context, role UserRole, limit int) ([]ScheduledNotification, error)
		Update(ctx context.Context, n *ScheduledNotification) error
		Delete(ctx context.Context, id string) error
		ClaimDue(ctx context.Context, now time.Time, limit int) ([]ScheduledNotification, error)
		MarkSent(ctx context.Context, id string, recipientCount int) error
		GenerateFromSchedule(ctx context.Context, lead time.Duration, targetRole *UserRole, createdBy string, now time.Time) (*ScheduleNotificationGenerationResult, error)
	}
	WalkIns interface {
		Enqueue(ctx context.Context, userID string) (inserted bool, position int, err error)
		PromoteNext(ctx context.Context, count int, promotedBy string) ([]User, error)
		QueueDepth(ctx context.Context) (pending int, total int, err error)
		List(ctx context.Context) ([]WalkIn, error)
	}
}

func NewStorage(db *sql.DB) Storage {
	settings := newSettingsStore(db)

	return Storage{
		Users:                  &UsersStore{db: db},
		Application:            &ApplicationsStore{db: db},
		Settings:               settings,
		Hackathon:              &HackathonStore{db: db, settings: settings},
		ApplicationReviews:     &ApplicationReviewsStore{db: db},
		Scans:                  &ScansStore{db: db},
		Schedule:               &ScheduleStore{db: db},
		Sponsors:               &SponsorsStore{db: db},
		FAQs:                   &FAQsStore{db: db},
		PushSubscriptions:      &PushSubscriptionsStore{db: db},
		ScheduledNotifications: &ScheduledNotificationsStore{db: db},
		WalkIns:                &WalkInsStore{db: db},
	}
}
