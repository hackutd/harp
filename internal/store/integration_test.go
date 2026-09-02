package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// These exercise the hand-written SQL against a real PostgreSQL instance. The
// query builders in this package are otherwise untested -- the handler suite
// runs entirely on MockStore, and CI has no database -- so a syntax or
// semantics error in a query would ship unnoticed.
//
// They are skipped unless HARP_TEST_DSN points at a database migrated to the
// current version, and they TRUNCATE the tables they use, so point them at a
// scratch database rather than your dev one:
//
//	createdb harp_test && migrate -path cmd/migrate/migrations -database "$HARP_TEST_DSN" up
//	HARP_TEST_DSN="postgres://admin:adminpassword@localhost:5432/harp_test?sslmode=disable" go test ./internal/store/
func integrationDB(t *testing.T) *sql.DB {
	dsn := os.Getenv("HARP_TEST_DSN")
	if dsn == "" {
		t.Skip("HARP_TEST_DSN not set; skipping database integration tests")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func seedIntegration(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	stmts := []string{
		`TRUNCATE applications, application_reviews, users CASCADE`,
		`INSERT INTO users (id, supertokens_user_id, email, role) VALUES
		  ('11111111-1111-1111-1111-111111111111','st-1','alice@example.com','hacker'),
		  ('22222222-2222-2222-2222-222222222222','st-2','bob@example.com','hacker'),
		  ('33333333-3333-3333-3333-333333333333','st-3','carol@example.com','hacker'),
		  ('44444444-4444-4444-4444-444444444444','st-a','admin@example.com','admin')`,
		`INSERT INTO applications (id, user_id, status, responses, submitted_at, accept_votes, travel_status, travel_yes_votes, rsvp_status, travel_rsvp_status, travel_receipt_paths, travel_approved_amount_cents) VALUES
		  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','accepted',
		     '{"first_name":"Alice","last_name":"Ng","travel_estimated_cost":250.5}', NOW(), 3, 'approved', 2, 'confirmed', 'pending', ARRAY['p/1.pdf'], 20000),
		  ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','submitted',
		     '{"first_name":"Bob","last_name":"Lee","travel_estimated_cost":1e20}', NOW(), 1, 'pending', 1, 'pending', 'pending', '{}', NULL),
		  ('aaaaaaaa-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','draft',
		     '{"first_name":"Carol","last_name":"Diaz"}', NULL, 0, 'not_requested', 0, 'pending', 'pending', '{}', NULL)`,
		`INSERT INTO application_reviews (id, application_id, admin_id) VALUES
		  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444'),
		  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444')`,
	}
	for _, s := range stmts {
		if _, err := db.ExecContext(ctx, s); err != nil {
			t.Fatalf("seed failed: %v\n%s", err, s)
		}
	}
}

func TestIntegrationList(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	s := &ApplicationsStore{db: db}
	ctx := context.Background()

	accepted := StatusAccepted
	travelApproved := TravelApproved
	rsvpConfirmed := RSVPConfirmed
	rsvpPending := RSVPPending
	yes, no := true, false
	search := "ali"

	cases := []struct {
		name    string
		filters ApplicationListFilters
		want    int
	}{
		{"no filters", ApplicationListFilters{}, 3},
		{"status", ApplicationListFilters{Status: &accepted}, 1},
		{"travel status", ApplicationListFilters{TravelStatus: &travelApproved}, 1},
		{"rsvp status", ApplicationListFilters{RSVPStatus: &rsvpConfirmed}, 1},
		{"travel rsvp status", ApplicationListFilters{TravelRSVPStatus: &rsvpPending}, 3},
		{"has receipts", ApplicationListFilters{HasReceipts: &yes}, 1},
		{"no receipts", ApplicationListFilters{HasReceipts: &no}, 2},
		{"travel requested", ApplicationListFilters{TravelRequested: &yes}, 2},
		{"travel not requested", ApplicationListFilters{TravelRequested: &no}, 1},
		{"search", ApplicationListFilters{Search: &search}, 1},
		{"vote sort", ApplicationListFilters{SortBy: SortByAcceptVotes}, 3},
		{"travel vote sort", ApplicationListFilters{SortBy: SortByTravelYesVotes}, 3},
		{"combined", ApplicationListFilters{Status: &accepted, TravelStatus: &travelApproved, HasReceipts: &yes, TravelRequested: &yes, SortBy: SortByTravelYesVotes}, 1},
	}

	for _, tc := range cases {
		res, err := s.List(ctx, tc.filters, nil, DirectionForward, 50)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if len(res.Applications) != tc.want {
			t.Errorf("%s: got %d rows, want %d", tc.name, len(res.Applications), tc.want)
		}
	}

	// Overflow guard: Bob's 1e20 estimate must read as NULL, not blow up.
	res, err := s.List(ctx, ApplicationListFilters{}, nil, DirectionForward, 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range res.Applications {
		switch *item.FirstName {
		case "Alice":
			if item.EstimatedTravelCostCents == nil || *item.EstimatedTravelCostCents != 25050 {
				t.Errorf("Alice cents = %v, want 25050", item.EstimatedTravelCostCents)
			}
		case "Bob":
			if item.EstimatedTravelCostCents != nil {
				t.Errorf("Bob cents = %v, want nil (out of range)", *item.EstimatedTravelCostCents)
			}
		}
	}
}

func TestIntegrationPagination(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	s := &ApplicationsStore{db: db}
	ctx := context.Background()

	for _, sortBy := range []ApplicationSortBy{SortByCreatedAt, SortByAcceptVotes, SortByTravelYesVotes} {
		f := ApplicationListFilters{SortBy: sortBy}
		page1, err := s.List(ctx, f, nil, DirectionForward, 2)
		if err != nil {
			t.Fatalf("%s page1: %v", sortBy, err)
		}
		if len(page1.Applications) != 2 || !page1.HasMore || page1.NextCursor == nil {
			t.Fatalf("%s page1: got %d rows hasMore=%v cursor=%v", sortBy, len(page1.Applications), page1.HasMore, page1.NextCursor)
		}
		cur, err := DecodeCursor(*page1.NextCursor)
		if err != nil {
			t.Fatal(err)
		}
		page2, err := s.List(ctx, f, cur, DirectionForward, 2)
		if err != nil {
			t.Fatalf("%s page2: %v", sortBy, err)
		}
		if len(page2.Applications) != 1 {
			t.Errorf("%s page2: got %d rows, want 1", sortBy, len(page2.Applications))
		}
		if page2.Applications[0].ID == page1.Applications[0].ID {
			t.Errorf("%s page2 repeated page1 row", sortBy)
		}
		// Walk back.
		back, err := s.List(ctx, f, cur, DirectionBackward, 2)
		if err != nil {
			t.Fatalf("%s backward: %v", sortBy, err)
		}
		if len(back.Applications) == 0 {
			t.Errorf("%s backward returned nothing", sortBy)
		}
	}
}

func TestIntegrationFormOperationsStats(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	s := &ApplicationsStore{db: db}

	stats, err := s.GetFormOperationsStats(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if stats.Applications.Started != 3 {
		t.Errorf("started = %d, want 3", stats.Applications.Started)
	}
	if stats.Travel.Requested != 2 {
		t.Errorf("travel requested = %d, want 2", stats.Travel.Requested)
	}
	// Alice 25050 counts; Bob's out-of-range estimate contributes nothing.
	if stats.Travel.RequestedEstimateCents != 25050 {
		t.Errorf("requested estimate = %d, want 25050", stats.Travel.RequestedEstimateCents)
	}
	if stats.Travel.ApprovedAmountCents != 20000 {
		t.Errorf("approved = %d, want 20000", stats.Travel.ApprovedAmountCents)
	}
	if stats.Travel.PeopleWithReceipts != 1 || stats.Travel.ReceiptFiles != 1 {
		t.Errorf("receipts = %d people / %d files, want 1/1", stats.Travel.PeopleWithReceipts, stats.Travel.ReceiptFiles)
	}
}

func TestIntegrationSubmitVote(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	s := &ApplicationReviewsStore{db: db}
	ctx := context.Background()
	admin := "44444444-4444-4444-4444-444444444444"
	travelReview := "bbbbbbbb-0000-0000-0000-000000000001" // app 2, travel_status = pending
	plainReview := "bbbbbbbb-0000-0000-0000-000000000002"  // app 3, not_requested
	yes := true

	if _, err := s.SubmitVote(ctx, plainReview, admin, ReviewVoteAccept, nil, nil); err != nil {
		t.Errorf("plain vote: %v", err)
	}
	if _, err := s.SubmitVote(ctx, travelReview, admin, ReviewVoteAccept, &yes, nil); err != nil {
		t.Errorf("travel vote: %v", err)
	}
	if _, err := s.SubmitVote(ctx, plainReview, admin, ReviewVoteAccept, &yes, nil); err != ErrVoteNotApplied {
		t.Errorf("travel vote on non-travel app: got %v, want ErrVoteNotApplied", err)
	}
	if _, err := s.SubmitVote(ctx, travelReview, admin, ReviewVoteAccept, nil, nil); err != ErrVoteNotApplied {
		t.Errorf("missing travel vote: got %v, want ErrVoteNotApplied", err)
	}
	if _, err := s.SubmitVote(ctx, "bbbbbbbb-0000-0000-0000-00000000ffff", admin, ReviewVoteAccept, nil, nil); err != ErrVoteNotApplied {
		t.Errorf("unknown review: got %v, want ErrVoteNotApplied", err)
	}
}

func TestIntegrationSettingsCache(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	s := newSettingsStore(db)
	ctx := context.Background()

	if err := s.SetRSVPEnabled(ctx, false); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetRSVPEnabled(ctx)
	if err != nil || got {
		t.Fatalf("after set false: %v %v", got, err)
	}
	if err := s.SetRSVPEnabled(ctx, true); err != nil {
		t.Fatal(err)
	}
	got, err = s.GetRSVPEnabled(ctx)
	if err != nil || !got {
		t.Fatalf("write did not invalidate: got %v err %v", got, err)
	}

	many, err := s.GetMany(ctx, SettingsKeyRSVPEnabled, SettingsKeyApplicationsEnabled, "definitely_missing_key")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := many["definitely_missing_key"]; ok {
		t.Error("GetMany returned a key that has no row")
	}
	if _, ok := many[SettingsKeyRSVPEnabled]; !ok {
		t.Error("GetMany missed rsvp_enabled")
	}
}

// seedIntegrationDeletion layers the rows a user deletion has to reason about on
// top of seedIntegration: the admin has reviewed two applications, checked Alice
// in, and scheduled a notification, and both they and Alice carry a
// review_assignment_toggle entry and uploaded files.
func seedIntegrationDeletion(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	stmts := []string{
		`INSERT INTO scans (id, user_id, scan_type, scanned_by, points) VALUES
		  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','check_in','44444444-4444-4444-4444-444444444444',5),
		  ('cccccccc-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','check_in','44444444-4444-4444-4444-444444444444',5),
		  ('cccccccc-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','lunch','44444444-4444-4444-4444-444444444444',0)`,
		`INSERT INTO scheduled_notifications (id, title, body, scheduled_at, created_by) VALUES
		  ('dddddddd-0000-0000-0000-000000000001','Doors open','Come on in', NOW() + interval '1 hour','44444444-4444-4444-4444-444444444444')`,
		`UPDATE applications SET resume_path = 'hackathons/test/resumes/11111111-1111-1111-1111-111111111111/abc.pdf'
		   WHERE user_id = '11111111-1111-1111-1111-111111111111'`,
		`INSERT INTO settings (key, value) VALUES ('review_assignment_toggle',
		  '[{"id":"44444444-4444-4444-4444-444444444444","enabled":true},{"id":"11111111-1111-1111-1111-111111111111","enabled":false}]'::jsonb)
		  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		`INSERT INTO settings (key, value) VALUES ('scan_stats', '{"check_in":99,"lunch":99}'::jsonb)
		  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
	}
	for _, s := range stmts {
		if _, err := db.ExecContext(ctx, s); err != nil {
			t.Fatalf("seed failed: %v\n%s", err, s)
		}
	}
}

func TestIntegrationDeleteAdmin(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	seedIntegrationDeletion(t, db)

	s := &UsersStore{db: db}
	ctx := context.Background()
	const adminID = "44444444-4444-4444-4444-444444444444"

	// scheduled_notifications.created_by used to be ON DELETE RESTRICT, which
	// made every staff account with a scheduled notification undeletable.
	paths, err := s.Delete(ctx, adminID)
	if err != nil {
		t.Fatalf("deleting the admin failed: %v", err)
	}
	if len(paths.Resumes) != 0 || len(paths.TravelReceipts) != 0 {
		t.Errorf("admin has no uploads, got %+v", paths)
	}

	// The scans they performed belong to the hackers and must outlive them.
	var scanCount, unattributed int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE scanned_by IS NULL) FROM scans`,
	).Scan(&scanCount, &unattributed); err != nil {
		t.Fatal(err)
	}
	if scanCount != 3 || unattributed != 3 {
		t.Errorf("got %d scans (%d unattributed), want 3 scans all unattributed", scanCount, unattributed)
	}

	var notifCount, orphanedNotifs int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE created_by IS NULL) FROM scheduled_notifications`,
	).Scan(&notifCount, &orphanedNotifs); err != nil {
		t.Fatal(err)
	}
	if notifCount != 1 || orphanedNotifs != 1 {
		t.Errorf("got %d notifications (%d unattributed), want 1 unattributed", notifCount, orphanedNotifs)
	}

	// Their two review assignments cascaded, and trg_update_vote_counts should
	// have walked the applications' counters back down.
	var reviewCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM application_reviews`).Scan(&reviewCount); err != nil {
		t.Fatal(err)
	}
	if reviewCount != 0 {
		t.Errorf("got %d review rows, want 0", reviewCount)
	}
	var maxAssigned int
	if err := db.QueryRowContext(ctx, `SELECT MAX(reviews_assigned) FROM applications`).Scan(&maxAssigned); err != nil {
		t.Fatal(err)
	}
	if maxAssigned != 0 {
		t.Errorf("reviews_assigned did not decrement: max is %d, want 0", maxAssigned)
	}

	// The toggle setting is a JSONB array keyed by user id with no foreign key,
	// so nothing but this method prunes it.
	var toggles []byte
	if err := db.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = 'review_assignment_toggle'`,
	).Scan(&toggles); err != nil {
		t.Fatal(err)
	}
	entries, err := parseReviewAssignmentEntries(toggles)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].ID != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("stale toggle entry left behind: %+v", entries)
	}

	if _, err := s.Delete(ctx, adminID); !errors.Is(err, ErrNotFound) {
		t.Errorf("second delete: got %v, want ErrNotFound", err)
	}
}

func TestIntegrationDeleteHacker(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	seedIntegrationDeletion(t, db)

	s := &UsersStore{db: db}
	ctx := context.Background()
	const aliceID = "11111111-1111-1111-1111-111111111111"

	paths, err := s.Delete(ctx, aliceID)
	if err != nil {
		t.Fatalf("deleting the hacker failed: %v", err)
	}
	if len(paths.Resumes) != 1 || paths.Resumes[0] != "hackathons/test/resumes/"+aliceID+"/abc.pdf" {
		t.Errorf("resume path not collected for storage cleanup: %+v", paths.Resumes)
	}
	if len(paths.TravelReceipts) != 1 || paths.TravelReceipts[0] != "p/1.pdf" {
		t.Errorf("travel receipt paths not collected: %+v", paths.TravelReceipts)
	}

	var remaining int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM scans WHERE user_id = $1`, aliceID).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Errorf("got %d of the hacker's own scans left, want 0", remaining)
	}

	// incrementScanStat never counts down, so the cascade above would otherwise
	// leave scan_stats permanently overcounted.
	var stats []byte
	if err := db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'scan_stats'`).Scan(&stats); err != nil {
		t.Fatal(err)
	}
	var got map[string]int
	if err := json.Unmarshal(stats, &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"check_in": 1}
	if len(got) != len(want) || got["check_in"] != want["check_in"] {
		t.Errorf("scan_stats = %v, want %v", got, want)
	}
}
