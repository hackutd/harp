package db

import (
	"database/sql"
	"log"
	"math/rand"
	"time"

	"github.com/hackutd/harp/internal/store"
)

// hackerCount is the number of hacker users (and therefore applications) the
// seed creates. Every bucket boundary in seed_applications.go is expressed as
// an absolute index into this range, so changing it means revisiting them.
const hackerCount = 200

// seedUserPrefix marks every user row the seeder owns. clean() deletes users by
// this prefix rather than truncating the table, so a real SuperTokens account
// used for manual testing survives a re-seed.
const seedUserPrefix = "seed-st-"

var rng = rand.New(rand.NewSource(42))

func pick[T any](opts []T) T { return opts[rng.Intn(len(opts))] }

func ptr[T any](v T) *T { return &v }

// chance reports true with the given percentage probability.
func chance(percent int) bool { return rng.Intn(100) < percent }

// between returns a random time in [start, end).
func between(start, end time.Time) time.Time {
	d := end.Sub(start)
	if d <= 0 {
		return start
	}
	return start.Add(time.Duration(rng.Int63n(int64(d))))
}

// timeline anchors every generated timestamp to a single event window that
// straddles "now": the hackathon started yesterday evening and ends tomorrow
// midday. That is the only arrangement where all of the super admin surfaces
// have data at once -- the schedule has both past and upcoming events, scans
// and sent notifications sit in the past, pending notifications sit in the
// future, and a walk-in queue makes sense at all.
type timeline struct {
	now        time.Time
	eventStart time.Time
	eventEnd   time.Time
	appOpen    time.Time
	appDue     time.Time
	decisions  time.Time
	rsvpClose  time.Time
}

func newTimeline(now time.Time) timeline {
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	eventStart := day.Add(-6 * time.Hour) // yesterday 18:00
	eventEnd := day.Add(36 * time.Hour)   // tomorrow 12:00

	appDue := eventStart.AddDate(0, 0, -21)
	return timeline{
		now:        now,
		eventStart: eventStart,
		eventEnd:   eventEnd,
		appOpen:    appDue.AddDate(0, 0, -30),
		appDue:     appDue,
		decisions:  eventStart.AddDate(0, 0, -14),
		rsvpClose:  eventStart.AddDate(0, 0, -2),
	}
}

func Seed(_ store.Storage, db *sql.DB) {
	log.Println("Seeding...")

	tl := newTimeline(time.Now())
	clean(db)

	staffIDs, superAdminIDs := seedStaff(db)
	hackerIDs := seedHackers(db, hackerCount)

	apps := seedApplications(db, hackerIDs, tl)
	seedReviews(db, staffIDs, apps, tl)
	seedEventData(db, staffIDs, superAdminIDs, apps, tl)
	seedContent(db, superAdminIDs, apps, tl)

	promoted := promoteRealSuperAdmin(db)
	seedSettings(db, append(superAdminIDs, promoted...), tl)

	summarize(db, tl)
	log.Println("Seeding complete!")
}

func mustBegin(db *sql.DB) *sql.Tx {
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("failed to begin transaction: %v", err)
	}
	return tx
}

func mustCommit(tx *sql.Tx, what string) {
	if err := tx.Commit(); err != nil {
		log.Fatalf("failed to commit %s: %v", what, err)
	}
}

func mustExec(tx *sql.Tx, what, query string, args ...any) {
	if _, err := tx.Exec(query, args...); err != nil {
		log.Fatalf("failed to %s: %v", what, err)
	}
}

// clean removes everything the seeder owns. Order matters:
//
//   - schedule is DELETEd rather than TRUNCATEd so that
//     scheduled_notifications.schedule_id fires its ON DELETE CASCADE.
//
// scheduled_notifications is still cleared before users, though created_by is
// now ON DELETE SET NULL rather than RESTRICT, so the seeded notifications are
// removed outright instead of surviving as unattributed rows.
//
// Users are filtered by seedUserPrefix so a real logged-in account survives.
// The content tables have no ownership column, so the seeder claims them
// wholesale -- same tradeoff the Danger Zone reset makes in
// internal/store/hackathon.go.
func clean(db *sql.DB) {
	tx := mustBegin(db)

	mustExec(tx, "clean scheduled_notifications", "DELETE FROM scheduled_notifications")
	mustExec(tx, "clean schedule", "DELETE FROM schedule")
	mustExec(tx, "clean sponsors", "DELETE FROM sponsors")
	mustExec(tx, "clean faqs", "DELETE FROM faqs")
	mustExec(tx, "clean seeded users",
		"DELETE FROM users WHERE supertokens_user_id LIKE $1", seedUserPrefix+"%")

	mustCommit(tx, "clean")
	log.Println("  cleaned previously seeded data")
}

// summarize prints what landed, so a run verifies itself at a glance.
func summarize(db *sql.DB, tl timeline) {
	type row struct {
		label string
		query string
	}
	rows := []row{
		{"users", "SELECT COUNT(*) FROM users"},
		{"applications", "SELECT COUNT(*) FROM applications"},
		{"application_reviews", "SELECT COUNT(*) FROM application_reviews"},
		{"scans", "SELECT COUNT(*) FROM scans"},
		{"walk_ins", "SELECT COUNT(*) FROM walk_ins"},
		{"schedule", "SELECT COUNT(*) FROM schedule"},
		{"sponsors", "SELECT COUNT(*) FROM sponsors"},
		{"faqs", "SELECT COUNT(*) FROM faqs"},
		{"scheduled_notifications", "SELECT COUNT(*) FROM scheduled_notifications"},
		{"push_subscriptions", "SELECT COUNT(*) FROM push_subscriptions"},
		{"settings", "SELECT COUNT(*) FROM settings"},
	}

	log.Println("  ---- row counts ----")
	for _, r := range rows {
		var n int
		if err := db.QueryRow(r.query).Scan(&n); err != nil {
			log.Fatalf("failed to count %s: %v", r.label, err)
		}
		log.Printf("  %-24s %5d", r.label, n)
	}
	log.Printf("  event window: %s -> %s",
		tl.eventStart.Format(time.RFC1123), tl.eventEnd.Format(time.RFC1123))
}
