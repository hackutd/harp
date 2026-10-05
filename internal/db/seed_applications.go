package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hackutd/harp/internal/store"
)

// seededApp is what later phases (reviews, scans, walk-ins) need to know about
// an application without re-reading it.
type seededApp struct {
	ID     string
	UserID string
	Index  int
	plan   appPlan
}

// appPlan fixes an application's whole lifecycle position up front. Buckets are
// assigned by index rather than sampled, so every count below is exact and
// reproducible -- the point of the seed is that each super admin screen has a
// known, non-degenerate distribution to look at.
type appPlan struct {
	Status string // draft | submitted | accepted | rejected | waitlisted

	RSVPStatus string // pending | confirmed | declined (only meaningful when accepted)

	// TravelRequested drives responses.travel_reimbursement, which is what the
	// application form actually records. TravelStatus is the organizer-side
	// decision and stays not_requested for drafts, mirroring the real flow
	// where travel enters review only at submit time.
	TravelRequested bool
	TravelStatus    string // not_requested | pending | approved | rejected
	TravelAward     bool   // approved *and* an explicit amount was recorded

	TravelRSVPStatus string // pending | confirmed | declined
	Receipts         int
}

// planFor maps a 0-based application index onto its lifecycle bucket.
//
//	  0.. 19  draft         (20)
//	 20.. 79  submitted     (60)  -- awaiting decision
//	 80..149  accepted      (70)
//	150..179  rejected      (30)
//	180..199  waitlisted    (20)  -- 14 of these back the walk-in queue
func planFor(i int) appPlan {
	p := appPlan{TravelStatus: "not_requested", TravelRSVPStatus: "pending"}

	switch {
	case i < 20:
		p.Status = "draft"
		// Drafts may have ticked the travel box without ever submitting, so the
		// response key is set while the review status stays not_requested.
		p.TravelRequested = i%4 == 0

	case i < 80:
		p.Status = "submitted"
		switch {
		case i < 34:
			p.TravelRequested, p.TravelStatus = true, "pending"
		case i < 40:
			p.TravelRequested, p.TravelStatus = true, "rejected"
		}

	case i < 150:
		p.Status = "accepted"
		switch {
		case i < 120:
			p.RSVPStatus = "confirmed"
		case i < 130:
			p.RSVPStatus = "declined"
		default:
			p.RSVPStatus = "pending"
		}

		switch {
		case i < 105:
			// The travel RSVP form is only reachable at
			// accepted + rsvp confirmed + travel approved, so this range is
			// deliberately the widest one.
			p.TravelRequested, p.TravelStatus, p.TravelAward = true, "approved", i < 100
			switch {
			case i < 95:
				p.TravelRSVPStatus = "confirmed"
				p.Receipts = 1 + i%3
			case i < 99:
				p.TravelRSVPStatus = "declined"
			}
		case i < 108:
			p.TravelRequested, p.TravelStatus = true, "pending"
		case i < 110:
			p.TravelRequested, p.TravelStatus = true, "rejected"
		case i >= 120 && i < 122:
			p.TravelRequested, p.TravelStatus, p.TravelAward = true, "approved", true
		case i >= 122 && i < 124:
			p.TravelRequested, p.TravelStatus = true, "rejected"
		case i >= 130 && i < 134:
			p.TravelRequested, p.TravelStatus, p.TravelAward = true, "approved", true
		case i >= 134 && i < 136:
			p.TravelRequested, p.TravelStatus = true, "pending"
		case i >= 136 && i < 138:
			p.TravelRequested, p.TravelStatus = true, "rejected"
		}

	case i < 180:
		p.Status = "rejected"
		if i < 158 {
			p.TravelRequested, p.TravelStatus = true, "rejected"
		}

	default:
		p.Status = "waitlisted"
		switch {
		case i < 184:
			p.TravelRequested, p.TravelStatus = true, "pending"
		case i < 186:
			p.TravelRequested, p.TravelStatus = true, "rejected"
		}
	}

	return p
}

const insertApplicationQuery = `
	INSERT INTO applications (
		user_id, status, responses, resume_path, ai_percent,
		submitted_at, created_at,
		decision_email_sent_at, announcement_email_sent_at,
		rsvp_status, rsvp_responses, rsvp_submitted_at,
		travel_status, travel_approved_amount_cents,
		travel_rsvp_status, travel_rsvp_responses, travel_rsvp_submitted_at,
		travel_receipt_paths
	) VALUES (
		$1, $2, $3, $4, $5,
		$6, $7,
		$8, $9,
		$10, $11, $12,
		$13, $14,
		$15, $16, $17,
		$18
	)
	RETURNING id
`

func seedApplications(db *sql.DB, hackerIDs []string, tl timeline) []seededApp {
	tx := mustBegin(db)

	apps := make([]seededApp, 0, len(hackerIDs))
	for i, userID := range hackerIDs {
		p := planFor(i)
		decided := p.Status == "accepted" || p.Status == "rejected" || p.Status == "waitlisted"

		createdAt := between(tl.appOpen, tl.appDue)
		var submittedAt *time.Time
		if p.Status != "draft" {
			submittedAt = ptr(between(createdAt, tl.appDue))
		}

		// Leave ~30% of decided applications un-emailed so SendEmailsDialog
		// reports a real pending count rather than "everyone already got one".
		var decisionEmailAt, announcementEmailAt *time.Time
		if decided && chance(70) {
			decisionEmailAt = ptr(between(tl.decisions, tl.decisions.Add(6*time.Hour)))
		}
		if p.Status != "draft" && chance(50) {
			announcementEmailAt = ptr(between(tl.decisions, tl.decisions.Add(24*time.Hour)))
		}

		var resumePath *string
		if p.Status != "draft" && chance(75) {
			resumePath = ptr(fmt.Sprintf("seed/resumes/hacker-%d.pdf", i+1))
		}

		var aiPercent *int
		if p.Status != "draft" && chance(60) {
			aiPercent = ptr(rng.Intn(96))
		}

		rsvpResponses, rsvpSubmittedAt := buildRSVPResponses(i, p, tl)
		travelResponses, travelSubmittedAt := buildTravelRSVPResponses(i, p, tl)

		var awardCents *int64
		if p.TravelAward {
			// Awards are recorded in whole dollars between $75 and $500.
			awardCents = ptr(int64((75 + rng.Intn(18)*25) * 100))
		}

		receipts := store.StringArray{}
		for r := 0; r < p.Receipts; r++ {
			receipts = append(receipts, fmt.Sprintf("seed/travel-receipts/hacker-%d-%d.pdf", i+1, r+1))
		}

		var id string
		err := tx.QueryRow(insertApplicationQuery,
			userID, p.Status, mustJSON(buildApplicationResponses(i, p)), resumePath, aiPercent,
			submittedAt, createdAt,
			decisionEmailAt, announcementEmailAt,
			rsvpStatusOrPending(p), mustJSON(rsvpResponses), rsvpSubmittedAt,
			p.TravelStatus, awardCents,
			p.TravelRSVPStatus, mustJSON(travelResponses), travelSubmittedAt,
			receipts,
		).Scan(&id)
		if err != nil {
			log.Fatalf("failed to insert application %d: %v", i, err)
		}

		apps = append(apps, seededApp{ID: id, UserID: userID, Index: i, plan: p})
	}

	mustCommit(tx, "applications")
	log.Printf("  inserted %d applications", len(apps))
	return apps
}

// rsvpStatusOrPending guards the column's NOT NULL default: only accepted
// applications carry a meaningful RSVP state.
func rsvpStatusOrPending(p appPlan) string {
	if p.RSVPStatus == "" {
		return "pending"
	}
	return p.RSVPStatus
}

// buildApplicationResponses fills the field ids defined by application_schema
// (migration 000006). Drafts get a partial set, which is what an abandoned
// half-finished form actually looks like.
func buildApplicationResponses(i int, p appPlan) map[string]any {
	first := firstNames[i%len(firstNames)]
	last := lastNames[(i*7)%len(lastNames)]
	submitted := p.Status != "draft"

	r := map[string]any{
		"first_name":           first,
		"last_name":            last,
		"phone":                fmt.Sprintf("+1214555%04d", i%10000),
		"age":                  18 + rng.Intn(10),
		"country_of_residence": pick(countries),
		"gender":               pick(genders),
		"race":                 pick(races),
		"ethnicity":            pick(ethnicities),
		"university":           pick(universities),
		"major":                pick(majors),
		"level_of_study":       pick(levels),
	}

	if !submitted {
		// An abandoned draft stops partway through. Which section it stops in
		// varies, so the drafts list is not 20 identical rows.
		if i%3 != 0 {
			r["github"] = fmt.Sprintf("https://github.com/%s%s%d", first, last, i)
			r["hackathons_attended"] = rng.Intn(6)
			r["experience_level"] = pick(expLevels)
		}
		if i%4 == 0 {
			r["saq_1"] = pick(saq1Pool)
		}
		if p.TravelRequested {
			r["travel_reimbursement"] = true
			r["travel_origin"] = pick(travelOrigins)
		}
		return r
	}

	r["github"] = fmt.Sprintf("https://github.com/%s%s%d", first, last, i)
	r["linkedin"] = fmt.Sprintf("https://linkedin.com/in/%s%s%d", first, last, i)
	if chance(40) {
		r["website"] = fmt.Sprintf("https://%s%d.dev", first, i)
	}
	r["hackathons_attended"] = rng.Intn(6)
	r["experience_level"] = pick(expLevels)
	r["heard_about"] = pick(heardFrom)
	r["saq_1"] = pick(saq1Pool)
	r["saq_2"] = pick(saq2Pool)
	r["saq_3"] = pick(saq3Pool)
	r["saq_4"] = pick(saq4Pool)
	r["shirt_size"] = pick(shirtSizes)
	r["dietary_restrictions"] = pickDietaryRestrictions()
	if chance(25) {
		r["accommodations"] = pick(accommodationPool)
	}
	r["ack_mlh_coc"] = true
	r["ack_mlh_data_sharing"] = true
	r["ack_mlh_contest_terms"] = true
	r["ack_mlh_privacy_policy"] = true
	r["opt_in_mlh_emails"] = chance(50)

	if p.TravelRequested {
		r["travel_reimbursement"] = true
		r["travel_origin"] = pick(travelOrigins)
		r["travel_mode"] = pick(travelModes)
		// travel_estimated_cost is the only way to populate the generated column
		// applications.travel_estimated_cost_cents (migration 000044), which
		// requires a plain numeric string -- anything else stores NULL.
		r["travel_estimated_cost"] = pick(travelCosts)
		r["travel_has_team"] = pick(travelHasTeam)
		r["travel_justification"] = pick(travelWhyPool)
	}

	return r
}

// buildRSVPResponses mirrors the field ids in rsvp_schema (migration 000035).
func buildRSVPResponses(i int, p appPlan, tl timeline) (map[string]any, *time.Time) {
	if p.RSVPStatus != "confirmed" && p.RSVPStatus != "declined" {
		return map[string]any{}, nil
	}

	submittedAt := ptr(between(tl.decisions, tl.rsvpClose))
	if p.RSVPStatus == "declined" {
		// A decline is a button, not a form -- only the timestamp is recorded.
		return map[string]any{}, submittedAt
	}

	r := map[string]any{
		"discord_username":        fmt.Sprintf("%s%d", pick(discordHandles), i),
		"emergency_contact_name":  fmt.Sprintf("%s %s", pick(firstNames), lastNames[(i*3)%len(lastNames)]),
		"emergency_contact_phone": fmt.Sprintf("+1972555%04d", (i*13)%10000),
		"ack_attendance":          true,
	}
	if chance(30) {
		r["additional_notes"] = "Arriving a little after check-in opens, please hold my badge."
	}
	return r, submittedAt
}

// buildTravelRSVPResponses mirrors travel_rsvp_schema (migration 000040).
// travel_rsvp_mode = "Flying" is over-represented on purpose: it is the branch
// that unlocks the conditional airline/flight fields and the ticket receipt
// requirement.
func buildTravelRSVPResponses(i int, p appPlan, tl timeline) (map[string]any, *time.Time) {
	if p.TravelRSVPStatus != "confirmed" && p.TravelRSVPStatus != "declined" {
		return map[string]any{}, nil
	}

	submittedAt := ptr(between(tl.rsvpClose.AddDate(0, 0, -5), tl.eventStart))
	if p.TravelRSVPStatus == "declined" {
		return map[string]any{}, submittedAt
	}

	mode := pick(travelRSVPModes)
	if i%2 == 0 {
		mode = "Flying"
	}

	r := map[string]any{
		"travel_rsvp_mode": mode,
		"payment_method":   pick(paymentMethods),
		"payment_details":  fmt.Sprintf("hacker%d@example.com", i+1),
	}
	if mode == "Flying" {
		r["flight_airline"] = pick(airlines)
		r["flight_numbers"] = fmt.Sprintf("%s%d, %s%d",
			[]string{"WN", "AA", "DL", "UA"}[i%4], 1000+rng.Intn(8999),
			[]string{"WN", "AA", "DL", "UA"}[i%4], 1000+rng.Intn(8999))
	}
	if note := pick(travelNotePool); note != "" {
		r["travel_notes"] = note
	}
	return r, submittedAt
}

func pickDietaryRestrictions() []string {
	if rng.Intn(5) < 2 {
		return []string{}
	}
	n := 1 + rng.Intn(2)
	perm := rng.Perm(len(dietaryOptions))
	result := make([]string, n)
	for i := 0; i < n; i++ {
		result[i] = dietaryOptions[perm[i]]
	}
	return result
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		log.Fatalf("failed to marshal seed JSON: %v", err)
	}
	return b
}
