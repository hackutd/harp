package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestIntegrationReferralAttribution(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	ctx := context.Background()
	// Before seeding: users references referrals, so CASCADE empties users too.
	if _, err := db.ExecContext(ctx, `TRUNCATE referrals, pending_referrals CASCADE`); err != nil {
		t.Fatal(err)
	}
	seedIntegration(t, db)

	refs := &ReferralsStore{db: db}
	users := &UsersStore{db: db}

	ref := &Referral{Name: "Kai Codes", Code: "NbjlBgit"}
	if err := refs.Create(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if err := refs.Create(ctx, &Referral{Name: "Dupe", Code: "nbjlbgit"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("code differing only in case: got %v, want ErrConflict", err)
	}

	if err := refs.RecordVisit(ctx, "NbjlBgit"); err != nil {
		t.Fatal(err)
	}
	if err := refs.RecordVisit(ctx, "unknown"); err != nil {
		t.Fatalf("unknown code should be ignored: %v", err)
	}

	// A new email is held, then claimed when its user row is created.
	if err := refs.RecordPending(ctx, "New@Example.com", "NbjlBgit"); err != nil {
		t.Fatal(err)
	}
	// An existing user and an unknown code are both ignored.
	if err := refs.RecordPending(ctx, "alice@example.com", "NbjlBgit"); err != nil {
		t.Fatal(err)
	}
	if err := refs.RecordPending(ctx, "other@example.com", "unknown"); err != nil {
		t.Fatal(err)
	}

	var pending int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pending_referrals`).Scan(&pending); err != nil {
		t.Fatal(err)
	}
	if pending != 1 {
		t.Fatalf("pending referrals: got %d, want 1", pending)
	}

	newUser := &User{SuperTokensUserID: "st-new", Email: "new@example.com", Role: RoleHacker, AuthMethod: AuthMethodPasswordless}
	if err := users.Create(ctx, newUser); err != nil {
		t.Fatal(err)
	}
	plainUser := &User{SuperTokensUserID: "st-plain", Email: "plain@example.com", Role: RoleHacker, AuthMethod: AuthMethodPasswordless}
	if err := users.Create(ctx, plainUser); err != nil {
		t.Fatal(err)
	}

	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pending_referrals`).Scan(&pending); err != nil {
		t.Fatal(err)
	}
	if pending != 0 {
		t.Fatalf("pending referral should be claimed: %d left", pending)
	}

	list, err := refs.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].SignupCount != 1 || list[0].VisitCount != 1 {
		t.Fatalf("list: got %+v, want one referral with 1 signup and 1 visit", list)
	}

	signups, err := refs.ListSignups(ctx, ref.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(signups) != 1 || signups[0].UserID != newUser.ID {
		t.Fatalf("signups: got %+v, want only %s", signups, newUser.ID)
	}

	ref.Name, ref.Code = "Kai Codes TikTok", "kaicodes"
	if err := refs.Update(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if ref.SignupCount != 1 {
		t.Fatalf("update: signup count %d, want 1", ref.SignupCount)
	}

	// Deleting the referral keeps the user and drops the attribution.
	if err := refs.Delete(ctx, ref.ID); err != nil {
		t.Fatal(err)
	}
	var referralID *string
	if err := db.QueryRowContext(ctx, `SELECT referral_id FROM users WHERE id = $1`, newUser.ID).Scan(&referralID); err != nil {
		t.Fatal(err)
	}
	if referralID != nil {
		t.Fatalf("referral_id should be cleared, got %s", *referralID)
	}
	if _, err := refs.ListSignups(ctx, ref.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("signups of deleted referral: got %v, want ErrNotFound", err)
	}
}

func TestIntegrationReferralExpiredPending(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	ctx := context.Background()
	if _, err := db.ExecContext(ctx, `TRUNCATE referrals, pending_referrals CASCADE`); err != nil {
		t.Fatal(err)
	}
	seedIntegration(t, db)

	refs := &ReferralsStore{db: db}
	users := &UsersStore{db: db}

	ref := &Referral{Name: "Kai Codes", Code: "NbjlBgit"}
	if err := refs.Create(ctx, ref); err != nil {
		t.Fatal(err)
	}
	// Older than the TTL, as if no later sign-in has swept it yet.
	if _, err := db.ExecContext(ctx,
		`INSERT INTO pending_referrals (email, referral_id, created_at) VALUES ($1, $2, $3)`,
		"late@example.com", ref.ID, time.Now().Add(-pendingReferralTTL-time.Hour),
	); err != nil {
		t.Fatal(err)
	}

	user := &User{SuperTokensUserID: "st-late", Email: "late@example.com", Role: RoleHacker, AuthMethod: AuthMethodPasswordless}
	if err := users.Create(ctx, user); err != nil {
		t.Fatal(err)
	}

	var referralID *string
	if err := db.QueryRowContext(ctx, `SELECT referral_id FROM users WHERE id = $1`, user.ID).Scan(&referralID); err != nil {
		t.Fatal(err)
	}
	if referralID != nil {
		t.Fatalf("expired pending referral should not credit the user, got %s", *referralID)
	}
	var pending int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pending_referrals`).Scan(&pending); err != nil {
		t.Fatal(err)
	}
	if pending != 0 {
		t.Fatalf("expired pending referral should still be deleted: %d left", pending)
	}
}

func TestIntegrationResetReferrals(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	ctx := context.Background()
	if _, err := db.ExecContext(ctx, `TRUNCATE referrals, pending_referrals CASCADE`); err != nil {
		t.Fatal(err)
	}
	seedIntegration(t, db)

	refs := &ReferralsStore{db: db}
	ref := &Referral{Name: "Kai Codes", Code: "NbjlBgit"}
	if err := refs.Create(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx,
		`UPDATE users SET referral_id = $1 WHERE email = 'alice@example.com'`, ref.ID,
	); err != nil {
		t.Fatal(err)
	}
	if err := refs.RecordPending(ctx, "new@example.com", "NbjlBgit"); err != nil {
		t.Fatal(err)
	}

	var usersBefore int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&usersBefore); err != nil {
		t.Fatal(err)
	}

	hackathon := &HackathonStore{db: db}
	if _, err := hackathon.Reset(ctx, ResetOptions{Referrals: true}); err != nil {
		t.Fatal(err)
	}

	var referrals, pending, usersAfter, attributed int
	if err := db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*) FROM referrals),
			(SELECT COUNT(*) FROM pending_referrals),
			(SELECT COUNT(*) FROM users),
			(SELECT COUNT(*) FROM users WHERE referral_id IS NOT NULL)
	`).Scan(&referrals, &pending, &usersAfter, &attributed); err != nil {
		t.Fatal(err)
	}
	if referrals != 0 || pending != 0 || attributed != 0 {
		t.Fatalf("after reset: %d referrals, %d pending, %d attributed users; want all 0", referrals, pending, attributed)
	}
	if usersAfter != usersBefore {
		t.Fatalf("reset must keep users: had %d, now %d", usersBefore, usersAfter)
	}
}
