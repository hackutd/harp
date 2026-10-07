package db

import (
	"database/sql"
	"log"
)

// seedReferrals creates a few influencer referral links and credits a share of the
// seeded hackers to them, with visit counts above the signups so the page
// shows a believable funnel. Random-looking codes are the default; "insta" is
// the hand-picked kind a super admin can set.
func seedReferrals(db *sql.DB, hackerIDs []string) {
	tx := mustBegin(db)

	// Referrals have no ownership column, so the seeder claims them wholesale
	// like sponsors. Real users' attributions are cleared by ON DELETE SET NULL.
	mustExec(tx, "clean referrals", "DELETE FROM referrals")

	referrals := []struct {
		name     string
		code     string
		share    int // percent of hackers credited
		visitsX2 int // visits as a multiple of signups, doubled to stay integral
	}{
		{"Kai Codes (TikTok)", "NbjlBgit", 18, 7},
		{"Priya Builds (YouTube)", "qHN7MoHx", 10, 9},
		{"DevWithDan (Instagram)", "Kd83vZpa", 4, 12},
		{"Instagram bio", "insta", 8, 5},
		{"Campus newsletter ad", "Tc4n7Rq2", 0, 0},
	}

	remaining := append([]string(nil), hackerIDs...)
	rng.Shuffle(len(remaining), func(i, j int) { remaining[i], remaining[j] = remaining[j], remaining[i] })

	credited := 0
	for _, ref := range referrals {
		signups := len(hackerIDs) * ref.share / 100
		if signups > len(remaining) {
			signups = len(remaining)
		}
		visits := signups*ref.visitsX2/2 + rng.Intn(6)

		var id string
		if err := tx.QueryRow(
			`INSERT INTO referrals (name, code, visit_count) VALUES ($1, $2, $3) RETURNING id`,
			ref.name, ref.code, visits,
		).Scan(&id); err != nil {
			log.Fatalf("failed to insert referral %s: %v", ref.name, err)
		}

		for _, userID := range remaining[:signups] {
			mustExec(tx, "credit referral",
				`UPDATE users SET referral_id = $1 WHERE id = $2`, id, userID)
		}
		remaining = remaining[signups:]
		credited += signups
	}

	mustCommit(tx, "referrals")
	log.Printf("  inserted %d referrals, credited %d hackers", len(referrals), credited)
}
