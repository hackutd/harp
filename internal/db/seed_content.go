package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/hackutd/harp/internal/store"
)

// seedContent fills the tables the marketing and event pages read: schedule,
// sponsors, FAQs, plus the notification queue and the push subscriptions that
// give it a non-zero recipient count.
func seedContent(db *sql.DB, superAdminIDs []string, apps []seededApp, tl timeline) {
	scheduleIDs := seedSchedule(db, tl)
	seedSponsors(db)
	seedFAQs(db)
	seedScheduledNotifications(db, superAdminIDs, scheduleIDs, tl)
	seedPushSubscriptions(db, superAdminIDs, apps)
}

func seedSchedule(db *sql.DB, tl timeline) []string {
	tx := mustBegin(db)

	ids := make([]string, 0, len(scheduleTemplate))
	for _, item := range scheduleTemplate {
		start := tl.eventStart.Add(time.Duration(item.StartHour * float64(time.Hour)))
		end := start.Add(time.Duration(item.DurationMins) * time.Minute)

		var id string
		err := tx.QueryRow(`
			INSERT INTO schedule (event_name, description, start_time, end_time, location, tags)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id`,
			item.Name, item.Description, start, end, item.Location, store.StringArray(item.Tags),
		).Scan(&id)
		if err != nil {
			log.Fatalf("failed to insert schedule item %q: %v", item.Name, err)
		}
		ids = append(ids, id)
	}

	mustCommit(tx, "schedule")
	log.Printf("  inserted %d schedule items", len(ids))
	return ids
}

func seedSponsors(db *sql.DB) {
	tx := mustBegin(db)

	for i, s := range sponsorTemplate {
		mustExec(tx, "insert sponsor", `
			INSERT INTO sponsors (name, tier, logo_data, logo_content_type, website_url, description, display_order)
			VALUES ($1, $2, $3, 'image/png', $4, $5, $6)`,
			s.Name, s.Tier, sponsorLogos[s.Logo], s.WebsiteURL, s.Description, (i+1)*10)
	}

	mustCommit(tx, "sponsors")
	log.Printf("  inserted %d sponsors", len(sponsorTemplate))
}

func seedFAQs(db *sql.DB) {
	tx := mustBegin(db)

	for i, f := range faqTemplate {
		mustExec(tx, "insert faq",
			`INSERT INTO faqs (question, answer, display_order) VALUES ($1, $2, $3)`,
			f.Question, f.Answer, (i+1)*10)
	}

	mustCommit(tx, "faqs")
	log.Printf("  inserted %d faqs", len(faqTemplate))
}

type seedNotification struct {
	Title string
	Body  string
	URL   *string
	// Role is nil for "everyone".
	Role *string
	// OffsetHours is relative to the event start; negative values are already
	// sent, positive ones are still queued.
	OffsetHours float64
	Sent        bool
	// LinkSchedule ties the row to a schedule item, which is what
	// POST /superadmin/notifications/from-schedule produces.
	LinkSchedule int
}

var notificationTemplate = []seedNotification{
	{"Check-in is open", "Head to the atrium with your student ID to grab your badge.", nil, ptr("hacker"), 0.25, true, -1},
	{"Opening ceremony starts in 15 minutes", "Main stage. Come find a seat.", nil, nil, 1.75, true, 1},
	{"Dinner is served", "Tacos in the dining hall. Vegan and halal trays are on the left.", nil, ptr("hacker"), 4, true, 3},
	{"Volunteer shift change", "Second shift, please check in with the ops desk.", nil, ptr("admin"), 5, true, -1},

	{"Midnight snack", "Pizza in the dining hall while it lasts.", nil, ptr("hacker"), 11, false, 8},
	{"Saturday breakfast", "Breakfast tacos and coffee are out.", nil, ptr("hacker"), 16, false, 11},
	{"Deploy workshop starting", "Room 2.410. Bring the thing you have not deployed yet.", ptr("https://example.com/deploy-workshop"), ptr("hacker"), 18, false, 12},
	{"Submissions close in one hour", "Get your Devpost entry in. The deadline is hard.", nil, ptr("hacker"), 38, false, -1},
	{"Judges briefing", "Exhibit hall, back corner. Rubrics will be handed out.", nil, ptr("admin"), 39, false, -1},
	{"Closing ceremony", "Main stage. Finalist demos, then prizes.", nil, nil, 41.25, false, 24},
}

func seedScheduledNotifications(db *sql.DB, superAdminIDs, scheduleIDs []string, tl timeline) {
	tx := mustBegin(db)

	for _, n := range notificationTemplate {
		scheduledAt := tl.eventStart.Add(time.Duration(n.OffsetHours * float64(time.Hour)))

		var sentAt *time.Time
		recipients := 0
		if n.Sent {
			sentAt = ptr(scheduledAt.Add(time.Duration(rng.Intn(90)) * time.Second))
			recipients = 30 + rng.Intn(90)
		}

		var scheduleID *string
		if n.LinkSchedule >= 0 && n.LinkSchedule < len(scheduleIDs) {
			scheduleID = &scheduleIDs[n.LinkSchedule]
		}

		mustExec(tx, "insert scheduled notification", `
			INSERT INTO scheduled_notifications
				(title, body, url, target_role, scheduled_at, sent_at, recipient_count, schedule_id, created_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			n.Title, n.Body, n.URL, n.Role, scheduledAt, sentAt, recipients,
			scheduleID, superAdminIDs[0])
	}

	mustCommit(tx, "scheduled notifications")
	log.Printf("  inserted %d scheduled notifications", len(notificationTemplate))
}

// seedPushSubscriptions gives the notification recipient preview something to
// count. The endpoints are fabricated: the first time the dispatcher actually
// sends, they return 404/410 and it prunes them (cmd/api/dispatcher.go).
func seedPushSubscriptions(db *sql.DB, superAdminIDs []string, apps []seededApp) {
	userAgents := []string{
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0",
	}

	userIDs := append([]string{}, superAdminIDs...)
	// Confirmed-RSVP hackers are the ones who would realistically have the PWA
	// installed by now.
	for _, app := range apps {
		if app.plan.RSVPStatus == "confirmed" && len(userIDs) < 12 {
			userIDs = append(userIDs, app.UserID)
		}
	}

	tx := mustBegin(db)
	for i, userID := range userIDs {
		mustExec(tx, "insert push subscription", `
			INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (endpoint) DO NOTHING`,
			userID,
			fmt.Sprintf("https://fcm.googleapis.com/fcm/send/seed-endpoint-%03d", i),
			fmt.Sprintf("seed-p256dh-key-%03d", i),
			fmt.Sprintf("seed-auth-%03d", i),
			userAgents[i%len(userAgents)])
	}
	mustCommit(tx, "push subscriptions")
	log.Printf("  inserted %d push subscriptions", len(userIDs))
}
