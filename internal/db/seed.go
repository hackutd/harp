package db

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/hackutd/portal/internal/store"
)

var rng = rand.New(rand.NewSource(42))

func pick(opts []string) string { return opts[rng.Intn(len(opts))] }

func ptr[T any](v T) *T { return &v }

func randomPastTime(maxDaysAgo int) time.Time {
	return time.Now().Add(-time.Duration(rng.Intn(maxDaysAgo*24)) * time.Hour)
}

var (
	firstNames = []string{
		"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank",
		"Ivy", "Jack", "Karen", "Leo", "Mia", "Noah", "Olivia", "Paul",
		"Quinn", "Ruby", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
		"Yara", "Zane", "Aria", "Blake", "Cora", "Derek",
	}
	lastNames = []string{
		"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
		"Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
		"Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
		"Lee", "Perez", "White", "Harris", "Sanchez", "Clark", "Ramirez",
		"Lewis", "Robinson", "Walker",
	}
	universities = []string{
		"UT Dallas", "UT Austin", "Texas A&M", "Rice University", "SMU",
		"UNT", "Texas Tech", "Baylor", "UT Arlington", "University of Houston",
	}
	majors = []string{
		"Computer Science", "Software Engineering", "Electrical Engineering",
		"Data Science", "Mathematics", "Information Technology", "Cybersecurity",
		"Mechanical Engineering", "Physics", "Business Analytics",
	}
	levels     = []string{"Freshman", "Sophomore", "Junior", "Senior", "Masters", "PhD"}
	genders    = []string{"Male", "Female", "Non-binary", "Prefer not to say"}
	shirtSizes = []string{"XS", "S", "M", "L", "XL", "XXL"}
	expLevels  = []string{"Beginner", "Intermediate", "Advanced", "Expert"}
	heardFrom  = []string{"Social Media", "Friend", "Professor", "Career Fair", "Website", "Email"}
	countries  = []string{"United States", "India", "Canada", "Mexico", "United Kingdom"}
	dietaries  = []string{"{}", "{}", "{}", "{halal}", "{vegetarian}", "{vegan}", "{nuts}", "{dairy}"}

	saqResponses = `{
		"saq_1": "I love building things and meeting new people!",
		"saq_2": "I have attended 2 hackathons and learned a lot about teamwork.",
		"saq_3": "I hope to learn new technologies and frameworks.",
		"saq_4": "I am looking forward to the workshops and networking."
	}`

	reviewNotePool = []string{
		"Strong technical background, good fit.",
		"Needs more experience, but shows potential.",
		"Great short answers, passionate about learning.",
		"Solid hackathon experience.",
		"Application could use more detail.",
		"Impressive project portfolio.",
	}
)

func Seed(_ store.Storage, db *sql.DB) {
	log.Println("Seeding...")

	clean(db)

	adminIDs, hackerIDs := seedUsers(db, 5000)
	appIDs, appStatuses := seedApplications(db, hackerIDs)
	seedReviews(db, adminIDs, appIDs, appStatuses)

	log.Println("Seeding complete!")
}

func clean(db *sql.DB) {
	for _, t := range []string{"application_reviews", "applications", "users"} {
		if _, err := db.Exec(fmt.Sprintf("DELETE FROM %s", t)); err != nil {
			log.Fatalf("failed to clean %s: %v", t, err)
		}
	}
	log.Println("  cleaned existing data")
}

func seedUsers(db *sql.DB, hackerCount int) (adminIDs, hackerIDs []string) {
	query := `
		INSERT INTO users (supertokens_user_id, email, role, auth_method)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	insert := func(stID, email, role, auth string) string {
		var id string
		if err := db.QueryRow(query, stID, email, role, auth).Scan(&id); err != nil {
			log.Fatalf("failed to insert user %s: %v", email, err)
		}
		return id
	}

	// Admins
	adminIDs = append(adminIDs, insert("seed-st-superadmin-1", "superadmin@hackutd.co", "super_admin", "passwordless"))
	adminIDs = append(adminIDs, insert("seed-st-admin-1", "admin1@hackutd.co", "admin", "passwordless"))
	adminIDs = append(adminIDs, insert("seed-st-admin-2", "admin2@hackutd.co", "admin", "google"))
	adminIDs = append(adminIDs, insert("seed-st-admin-3", "admin3@hackutd.co", "admin", "passwordless"))

	// Hackers
	for i := 1; i <= hackerCount; i++ {
		id := insert(
			fmt.Sprintf("seed-st-hacker-%d", i),
			fmt.Sprintf("hacker%d@example.com", i),
			"hacker", "passwordless",
		)
		hackerIDs = append(hackerIDs, id)
	}

	log.Printf("  inserted %d users (%d admins + %d hackers)", 4+hackerCount, 4, hackerCount)
	return adminIDs, hackerIDs
}

func seedApplications(db *sql.DB, hackerIDs []string) (appIDs, appStatuses []string) {
	query := `
		INSERT INTO applications (
			user_id, status,
			first_name, last_name, phone_e164, age,
			country_of_residence, gender, race, ethnicity,
			university, major, level_of_study,
			short_answer_responses,
			hackathons_attended_count, software_experience_level, heard_about,
			shirt_size, dietary_restrictions, accommodations,
			github, linkedin,
			ack_application, ack_mlh_coc, ack_mlh_privacy, opt_in_mlh_emails,
			submitted_at
		) VALUES (
			$1,  $2,
			$3,  $4,  $5,  $6,
			$7,  $8,  $9,  $10,
			$11, $12, $13,
			$14,
			$15, $16, $17,
			$18, $19, $20,
			$21, $22,
			$23, $24, $25, $26,
			$27
		) RETURNING id
	`

	for i, userID := range hackerIDs {
		status := pickStatus()
		submitted := status != "draft"

		first := firstNames[i%len(firstNames)]
		last := lastNames[i%len(lastNames)]

		var submittedAt *time.Time
		if submitted {
			submittedAt = ptr(randomPastTime(30))
		}

		var id string
		err := db.QueryRow(query,
			userID, status,
			first, last, fmt.Sprintf("+1214555%04d", i%10000), int16(18+rng.Intn(10)),
			pick(countries), pick(genders), "Asian", "Hispanic",
			pick(universities), pick(majors), pick(levels),
			saqResponses,
			int16(rng.Intn(6)), pick(expLevels), pick(heardFrom),
			pick(shirtSizes), pick(dietaries), nil,
			fmt.Sprintf("https://github.com/%s%s%d", first, last, i),
			fmt.Sprintf("https://linkedin.com/in/%s%s%d", first, last, i),
			submitted, submitted, submitted, rng.Intn(2) == 0,
			submittedAt,
		).Scan(&id)
		if err != nil {
			log.Fatalf("failed to insert application %d: %v", i, err)
		}

		appIDs = append(appIDs, id)
		appStatuses = append(appStatuses, status)
	}

	log.Printf("  inserted %d applications", len(appIDs))
	return appIDs, appStatuses
}

func pickStatus() string {
	r := rng.Intn(100)
	switch {
	case r < 15:
		return "draft"
	case r < 65:
		return "submitted"
	case r < 80:
		return "accepted"
	case r < 90:
		return "rejected"
	default:
		return "waitlisted"
	}
}

func seedReviews(db *sql.DB, adminIDs, appIDs, appStatuses []string) {
	query := `
		INSERT INTO application_reviews (application_id, admin_id, vote, notes, reviewed_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (application_id, admin_id) DO NOTHING
	`

	allVotes := []store.ReviewVote{store.ReviewVoteAccept, store.ReviewVoteReject, store.ReviewVoteWaitlist}
	count := 0

	for i, appID := range appIDs {
		status := appStatuses[i]
		if status == "draft" {
			continue
		}

		// 2 or 3 reviewers per app
		numReviewers := min(2+rng.Intn(2), len(adminIDs))
		perm := rng.Perm(len(adminIDs))

		for j := 0; j < numReviewers; j++ {
			adminID := adminIDs[perm[j]]
			vote, notes, reviewedAt := buildVote(status, allVotes)

			if _, err := db.Exec(query, appID, adminID, vote, notes, reviewedAt); err != nil {
				log.Fatalf("failed to insert review for app %s: %v", appID, err)
			}
			count++
		}
	}

	log.Printf("  inserted %d reviews", count)
}

func buildVote(appStatus string, allVotes []store.ReviewVote) (*store.ReviewVote, *string, *time.Time) {
	if appStatus == "submitted" && rng.Intn(3) == 0 {
		return nil, nil, nil
	}

	var v store.ReviewVote
	switch appStatus {
	case "accepted":
		v = store.ReviewVoteAccept
	case "rejected":
		v = store.ReviewVoteReject
	case "waitlisted":
		v = store.ReviewVoteWaitlist
	default:
		v = allVotes[rng.Intn(len(allVotes))]
	}

	return &v, ptr(pick(reviewNotePool)), ptr(randomPastTime(14))
}
