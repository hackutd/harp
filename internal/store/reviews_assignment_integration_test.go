package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
)

func batchTestExec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func batchTestSeed(t *testing.T, admins, apps int) (*sql.DB, *ApplicationReviewsStore, []string, []string) {
	t.Helper()
	db := integrationDB(t)
	t.Cleanup(func() { db.Close() })
	batchTestExec(t, db, "TRUNCATE application_reviews, applications, users CASCADE")
	batchTestExec(t, db, "DELETE FROM settings WHERE key IN ('review_assignment_toggle', 'reviews_per_application')")
	t.Cleanup(func() {
		batchTestCheckCounters(t, db)
		batchTestExec(t, db, "DELETE FROM settings WHERE key IN ('review_assignment_toggle', 'reviews_per_application')")
	})
	var adminIDs, appIDs []string
	for i := 0; i < admins; i++ {
		id := fmt.Sprintf("10000000-0000-0000-0000-%012d", i+1)
		batchTestExec(t, db, "INSERT INTO users (id, supertokens_user_id, email, role, created_at) VALUES ($1, $2, $3, 'admin', '2026-01-01'::timestamptz + $4 * interval '1 second')", id, id, fmt.Sprintf("admin%d@example.com", i), i)
		adminIDs = append(adminIDs, id)
	}
	for i := 0; i < apps; i++ {
		userID := fmt.Sprintf("20000000-0000-0000-0000-%012d", i+1)
		appID := fmt.Sprintf("30000000-0000-0000-0000-%012d", i+1)
		batchTestExec(t, db, "INSERT INTO users (id, supertokens_user_id, email, role) VALUES ($1, $2, $3, 'hacker')", userID, userID, fmt.Sprintf("hacker%d@example.com", i))
		batchTestExec(t, db, "INSERT INTO applications (id, user_id, status, submitted_at) VALUES ($1, $2, 'submitted', '2026-01-02'::timestamptz + $3 * interval '1 second')", appID, userID, i)
		appIDs = append(appIDs, appID)
	}
	return db, &ApplicationReviewsStore{db: db}, adminIDs, appIDs
}

func batchTestBatch(t *testing.T, s *ApplicationReviewsStore, target int) int {
	t.Helper()
	r, err := s.BatchAssign(context.Background(), target)
	if err != nil {
		t.Fatal(err)
	}
	return r.ReviewsCreated
}

func batchTestCount(t *testing.T, db *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func batchTestCheckCounters(t *testing.T, db *sql.DB) {
	t.Helper()
	n := batchTestCount(t, db, `SELECT count(*) FROM applications a WHERE
	 a.reviews_assigned <> (SELECT count(*) FROM application_reviews r WHERE r.application_id = a.id) OR
	 a.reviews_completed <> (SELECT count(*) FROM application_reviews r WHERE r.application_id = a.id AND r.vote IS NOT NULL) OR
	 a.accept_votes <> (SELECT count(*) FROM application_reviews r WHERE r.application_id = a.id AND r.vote = 'accept') OR
	 a.reject_votes <> (SELECT count(*) FROM application_reviews r WHERE r.application_id = a.id AND r.vote = 'reject')`)
	if n != 0 {
		t.Errorf("%d applications have incorrect counters", n)
	}
}

func TestIntegrationBatchAssign(t *testing.T) {
	ctx := context.Background()
	t.Run("fresh_assignment_and_repeat", func(t *testing.T) {
		db, s, _, _ := batchTestSeed(t, 4, 12)
		if n := batchTestBatch(t, s, 3); n != 36 {
			t.Errorf("created=%d, want 36", n)
		}
		if n := batchTestCount(t, db, "SELECT count(*) FROM applications WHERE reviews_assigned <> 3"); n != 0 {
			t.Errorf("%d applications lack three reviews", n)
		}
		if n := batchTestBatch(t, s, 3); n != 0 {
			t.Errorf("repeat created=%d, want 0", n)
		}
		batchTestCheckCounters(t, db)
	})
	t.Run("raise_count_after_completed_reviews", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 3, 1)
		batchTestBatch(t, s, 2)
		for _, admin := range admins {
			pending, err := s.GetPendingByAdminID(ctx, admin)
			if err != nil {
				t.Fatal(err)
			}
			for _, r := range pending {
				if _, err := s.SubmitVote(ctx, r.ID, admin, ReviewVoteAccept, nil, nil); err != nil {
					t.Fatal(err)
				}
			}
		}
		if n := batchTestBatch(t, s, 3); n != 1 {
			t.Errorf("target increase created=%d, want 1", n)
		}
		if n := batchTestBatch(t, s, 3); n != 0 {
			t.Errorf("repeat created=%d, want 0", n)
		}
		if n := batchTestCount(t, db, "SELECT reviews_assigned FROM applications"); n != 3 {
			t.Errorf("assigned=%d, want 3; third reviewer is eligible", n)
		}
		batchTestCheckCounters(t, db)
	})
	t.Run("raise_count_with_pending_reviews", func(t *testing.T) {
		db, s, _, _ := batchTestSeed(t, 3, 6)
		batchTestBatch(t, s, 2)
		if n := batchTestBatch(t, s, 3); n != 6 {
			t.Errorf("target increase created=%d, want 6", n)
		}
		if n := batchTestCount(t, db, "SELECT count(*) FROM applications WHERE reviews_assigned < 3"); n != 0 {
			t.Errorf("%d applications remain under-assigned despite enough reviewers", n)
		}
	})
	t.Run("decrease_target_retains_existing_assignments", func(t *testing.T) {
		db, s, _, _ := batchTestSeed(t, 3, 1)
		batchTestBatch(t, s, 3)
		settings := &SettingsStore{db: db}
		if err := settings.SetReviewsPerApplication(ctx, 1); err != nil {
			t.Fatal(err)
		}
		target, err := settings.GetReviewsPerApplication(ctx)
		if err != nil {
			t.Fatal(err)
		}
		batchTestBatch(t, s, target)
		n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE vote IS NULL")
		t.Logf("saved target=%d; pending assignments retained=%d", target, n)
		if n != 3 {
			t.Errorf("unexpected pending count=%d", n)
		}
	})
	t.Run("disabled_reviewer_cleanup_without_eligible_admins", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 1, 1)
		batchTestExec(t, db, "UPDATE users SET role='super_admin' WHERE id=$1", admins[0])
		batchTestBatch(t, s, 1)
		settings := &SettingsStore{db: db}
		if err := settings.SetReviewAssignmentToggle(ctx, admins[0], false); err != nil {
			t.Fatal(err)
		}
		batchTestBatch(t, s, 1)
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE vote IS NULL"); n != 0 {
			t.Errorf("%d pending reviews retained for disabled reviewer; cleanup rolled back", n)
		}
	})
	t.Run("disabled_reviewer_cleanup_when_application_decided", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 2, 1)
		batchTestExec(t, db, "UPDATE users SET role='super_admin' WHERE id=$1", admins[0])
		batchTestBatch(t, s, 1)
		batchTestExec(t, db, "UPDATE applications SET status='accepted'")
		settings := &SettingsStore{db: db}
		if err := settings.SetReviewAssignmentToggle(ctx, admins[0], false); err != nil {
			t.Fatal(err)
		}
		batchTestBatch(t, s, 1)
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE vote IS NULL"); n != 0 {
			t.Errorf("%d pending reviews retained after cleanup because there were no submitted candidates", n)
		}
	})
	t.Run("disabled_reviewer_redistribution", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 3, 1)
		batchTestExec(t, db, "UPDATE users SET role='super_admin' WHERE id=$1", admins[0])
		batchTestBatch(t, s, 2)
		settings := &SettingsStore{db: db}
		if err := settings.SetReviewAssignmentToggle(ctx, admins[0], false); err != nil {
			t.Fatal(err)
		}
		batchTestBatch(t, s, 2)
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE admin_id=$1", admins[0]); n != 0 {
			t.Errorf("disabled reviewer still owns %d assignments", n)
		}
		if n := batchTestCount(t, db, "SELECT reviews_assigned FROM applications"); n != 2 {
			t.Errorf("assigned=%d, want 2", n)
		}
		batchTestCheckCounters(t, db)
	})
	t.Run("demoted_reviewer_assignments_recovered", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 3, 1)
		batchTestBatch(t, s, 2)
		if _, err := (&UsersStore{db: db}).UpdateRole(ctx, admins[0], RoleHacker); err != nil {
			t.Fatal(err)
		}
		batchTestBatch(t, s, 2)
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews r JOIN users u ON u.id=r.admin_id WHERE r.vote IS NULL AND u.role='hacker'"); n != 0 {
			t.Errorf("%d assignments stuck under a user who can no longer access review endpoints", n)
		}
	})
	t.Run("workload_balancing", func(t *testing.T) {
		db, s, admins, apps := batchTestSeed(t, 2, 14)
		for _, app := range apps[:10] {
			batchTestExec(t, db, "INSERT INTO application_reviews(application_id,admin_id) VALUES ($1,$2)", app, admins[0])
		}
		batchTestBatch(t, s, 1)
		a := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE admin_id=$1", admins[0])
		b := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE admin_id=$1", admins[1])
		t.Logf("initial workload 10:0; after four new assignments %d:%d", a, b)
		if a != 10 || b != 4 {
			t.Errorf("expected new assignments to go to reviewer with lower workload")
		}
	})
	t.Run("self_review_and_insufficient_capacity", func(t *testing.T) {
		db, s, admins, apps := batchTestSeed(t, 2, 1)
		batchTestExec(t, db, "UPDATE applications SET user_id=$1 WHERE id=$2", admins[0], apps[0])
		t.Logf("target=3; eligible distinct non-self reviewers=1; created=%d", batchTestBatch(t, s, 3))
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews r JOIN applications a ON a.id=r.application_id WHERE r.admin_id=a.user_id"); n != 0 {
			t.Errorf("self reviews=%d", n)
		}
		if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews"); n != 1 {
			t.Errorf("assignments=%d, want 1", n)
		}
	})
	t.Run("vote_update_counters_and_queue_completion", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 3, 3)
		batchTestBatch(t, s, 3)
		for _, admin := range admins {
			pending, err := s.GetPendingByAdminID(ctx, admin)
			if err != nil {
				t.Fatal(err)
			}
			for _, r := range pending {
				if _, err := s.SubmitVote(ctx, r.ID, admin, ReviewVoteAccept, nil, nil); err != nil {
					t.Fatal(err)
				}
				if _, err := s.SubmitVote(ctx, r.ID, admin, ReviewVoteReject, nil, nil); err != nil {
					t.Fatal(err)
				}
			}
			pending, err = s.GetPendingByAdminID(ctx, admin)
			if err != nil || len(pending) != 0 {
				t.Fatalf("pending=%d err=%v", len(pending), err)
			}
			completed, err := s.GetCompletedByAdminID(ctx, admin)
			if err != nil || len(completed) != 3 {
				t.Fatalf("completed=%d err=%v", len(completed), err)
			}
		}
		batchTestCheckCounters(t, db)
		if n := batchTestCount(t, db, "SELECT count(*) FROM applications WHERE reviews_completed=3 AND reject_votes=3"); n != 3 {
			t.Errorf("fully completed applications=%d, want 3", n)
		}
	})

	t.Run("committed_cleanup_statistics", func(t *testing.T) {
		for _, decided := range []bool{false, true} {
			t.Run(fmt.Sprint(decided), func(t *testing.T) {
				db, s, admins, _ := batchTestSeed(t, 1, 1)
				batchTestBatch(t, s, 1)
				batchTestExec(t, db, "UPDATE users SET role='hacker' WHERE id=$1", admins[0])
				if decided {
					batchTestExec(t, db, "UPDATE applications SET status='accepted'")
				}
				r, err := s.BatchAssign(ctx, 2)
				if err != nil {
					t.Fatal(err)
				}
				want := BatchAssignmentResult{ReviewsRemoved: 1, ReviewsPerApplication: 2}
				if !decided {
					want.ApplicationsBelowTarget = 1
					want.ReviewsUnfilled = 2
				}
				if *r != want {
					t.Errorf("result=%+v, want %+v", *r, want)
				}
				if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews"); n != 0 {
					t.Errorf("cleanup retained %d rows", n)
				}
			})
		}
	})
	t.Run("completed_ineligible_reviews_preserved", func(t *testing.T) {
		for _, demoted := range []bool{false, true} {
			t.Run(fmt.Sprint(demoted), func(t *testing.T) {
				db, s, admins, _ := batchTestSeed(t, 3, 2)
				batchTestBatch(t, s, 2)
				pending, err := s.GetPendingByAdminID(ctx, admins[0])
				if err != nil || len(pending) == 0 {
					t.Fatalf("pending: %v", err)
				}
				if _, err := s.SubmitVote(ctx, pending[0].ID, admins[0], ReviewVoteAccept, nil, nil); err != nil {
					t.Fatal(err)
				}
				if demoted {
					if _, err := (&UsersStore{db: db}).UpdateRole(ctx, admins[0], RoleHacker); err != nil {
						t.Fatal(err)
					}
				} else if err := (&SettingsStore{db: db}).SetReviewAssignmentToggle(ctx, admins[0], false); err != nil {
					t.Fatal(err)
				}
				r, err := s.BatchAssign(ctx, 2)
				if err != nil {
					t.Fatal(err)
				}
				if r.ApplicationsBelowTarget != 0 {
					t.Errorf("shortage: %+v", r)
				}
				if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE admin_id=$1 AND vote='accept'", admins[0]); n != 1 {
					t.Errorf("completed reviews=%d", n)
				}
				if n := batchTestCount(t, db, "SELECT count(*) FROM application_reviews WHERE admin_id=$1 AND vote IS NULL", admins[0]); n != 0 {
					t.Errorf("ineligible pending reviews=%d", n)
				}
			})
		}
	})
	t.Run("shortage_and_self_review_reporting", func(t *testing.T) {
		db, s, admins, apps := batchTestSeed(t, 2, 1)
		batchTestExec(t, db, "UPDATE applications SET user_id=$1 WHERE id=$2", admins[0], apps[0])
		r, err := s.BatchAssign(ctx, 3)
		if err != nil {
			t.Fatal(err)
		}
		want := BatchAssignmentResult{ReviewsCreated: 1, ReviewsPerApplication: 3, ApplicationsBelowTarget: 1, ReviewsUnfilled: 2}
		if *r != want {
			t.Errorf("result=%+v, want %+v", *r, want)
		}
		r, err = s.BatchAssign(ctx, 3)
		if err != nil {
			t.Fatal(err)
		}
		want.ReviewsCreated = 0
		if *r != want {
			t.Errorf("repeat=%+v, want %+v", *r, want)
		}
	})
	t.Run("legacy_toggle_and_backfill", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 2, 0)
		batchTestExec(t, db, "UPDATE users SET role='super_admin'")
		batchTestExec(t, db, "INSERT INTO settings(key,value) VALUES ('review_assignment_toggle',jsonb_build_array($1::text))", admins[0])
		r, err := s.BatchAssign(ctx, 3)
		if err != nil {
			t.Fatal(err)
		}
		if r.ReviewsCreated != 0 {
			t.Fatalf("unexpected assignments: %+v", r)
		}
		entries, err := (&SettingsStore{db: db}).GetAllReviewAssignmentToggles(ctx)
		if err != nil || len(entries) != 2 {
			t.Fatalf("backfill=%+v, err=%v", entries, err)
		}
		for _, entry := range entries {
			if !entry.Enabled {
				t.Errorf("legacy/backfilled reviewer disabled: %+v", entry)
			}
		}
	})
	t.Run("simultaneous_batches", func(t *testing.T) {
		for _, absent := range []bool{false, true} {
			t.Run(fmt.Sprint(absent), func(t *testing.T) {
				db, s, _, _ := batchTestSeed(t, 4, 12)
				if !absent {
					batchTestExec(t, db, "INSERT INTO settings(key,value) VALUES ('review_assignment_toggle','[]')")
				}
				type outcome struct {
					result *BatchAssignmentResult
					err    error
				}
				start := make(chan struct{})
				results := make(chan outcome, 2)
				for range 2 {
					go func() { <-start; r, err := s.BatchAssign(ctx, 3); results <- outcome{r, err} }()
				}
				close(start)
				created := 0
				for range 2 {
					r := <-results
					if r.err != nil {
						t.Error(r.err)
						continue
					}
					created += r.result.ReviewsCreated
					if r.result.ReviewsUnfilled != 0 {
						t.Errorf("shortage: %+v", r.result)
					}
				}
				if created != 36 {
					t.Errorf("created=%d, want 36", created)
				}
				if n := batchTestCount(t, db, "SELECT count(*) FROM applications WHERE reviews_assigned <> 3"); n != 0 {
					t.Errorf("%d applications have wrong totals", n)
				}
			})
		}
	})
	t.Run("individual_and_batch_assignment", func(t *testing.T) {
		db, s, admins, _ := batchTestSeed(t, 3, 8)
		start := make(chan struct{})
		errs := make(chan error, 2)
		go func() { <-start; _, err := s.BatchAssign(ctx, 2); errs <- err }()
		go func() {
			<-start
			_, err := s.AssignNextForAdmin(ctx, admins[0], 2)
			if errors.Is(err, ErrNotFound) {
				err = nil
			}
			errs <- err
		}()
		close(start)
		for range 2 {
			if err := <-errs; err != nil {
				t.Error(err)
			}
		}
		if n := batchTestCount(t, db, "SELECT count(*) FROM applications WHERE reviews_assigned <> 2"); n != 0 {
			t.Errorf("%d applications have wrong totals", n)
		}
	})
}
