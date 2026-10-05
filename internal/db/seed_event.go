package db

import (
	"database/sql"
	"log"
	"time"
)

type seedScanType struct {
	Name        string
	DisplayName string
	Category    string
	Points      int
	IsActive    bool
}

// seedScanTypes is written verbatim into settings.scan_types and is also the
// menu seedScans draws from, so the two can never disagree.
//
// updateScanTypesHandler requires at least one active check_in type and one
// active walk_in type, so those two are load-bearing rather than decorative.
//
// Points on a shop type is a *cost*: createScanHandler negates it and stores a
// repeatable row (internal/store/scans.go CreatePurchase). Every other category
// stores its points positively and non-repeatably, which is why the seeded rows
// below mirror that convention exactly.
var seedScanTypes = []seedScanType{
	{"check_in", "Check In", "check_in", 0, true},
	{"walk_in", "Walk-In", "walk_in", 0, true},

	{"meal_fri_dinner", "Friday Dinner", "meal", 0, true},
	{"meal_sat_breakfast", "Saturday Breakfast", "meal", 0, true},
	{"meal_sat_lunch", "Saturday Lunch", "meal", 0, true},
	{"meal_sat_dinner", "Saturday Dinner", "meal", 0, true},
	{"meal_sun_breakfast", "Sunday Breakfast", "meal", 0, true},

	{"swag_tshirt", "T-Shirt Pickup", "swag", 5, true},
	{"swag_sticker_pack", "Sticker Pack", "swag", 5, true},
	{"swag_hat", "Bucket Hat (sold out)", "swag", 5, false},

	{"workshop_intro_ai", "Workshop: Intro to AI Agents", "other", 15, true},
	{"workshop_git", "Workshop: Git for Teams", "other", 15, true},
	{"sponsor_booth_visit", "Sponsor Booth Tour", "other", 15, true},
	{"minigame_win", "Cup Stacking Win", "other", 30, true},

	{"shop_pin", "Shop: Enamel Pin", "shop", 15, true},
	{"shop_bottle", "Shop: Water Bottle", "shop", 25, true},
	{"shop_hoodie", "Shop: Hoodie", "shop", 60, true},
}

var (
	mealScanTypes     = []string{"meal_fri_dinner", "meal_sat_breakfast", "meal_sat_lunch", "meal_sat_dinner", "meal_sun_breakfast"}
	workshopScanTypes = []string{"workshop_intro_ai", "workshop_git", "sponsor_booth_visit"}
	shopScanTypes     = []string{"shop_pin", "shop_bottle", "shop_hoodie"}
)

func scanTypePoints(name string) int {
	for _, t := range seedScanTypes {
		if t.Name == name {
			return t.Points
		}
	}
	return 0
}

// walkInCount entries come off the tail of the waitlisted bucket; the first
// walkInPromoted of them have already been let in.
const (
	walkInStartIndex = 180
	walkInCount      = 14
	walkInPromoted   = 4
)

// seedEventData writes everything that only exists because the event is
// underway: the walk-in queue, door scans, and the meal groups handed out at
// check-in. It runs after applications because promoting a walk-in rewrites an
// application's status.
func seedEventData(db *sql.DB, staffIDs, superAdminIDs []string, apps []seededApp, tl timeline) {
	byIndex := make(map[int]seededApp, len(apps))
	for _, a := range apps {
		byIndex[a.Index] = a
	}

	walkIns := seedWalkIns(db, superAdminIDs, byIndex, tl)
	checkedIn := seedScans(db, staffIDs, byIndex, walkIns, tl)
	seedMealGroups(db, checkedIn)
}

// seedWalkIns builds a queue out of waitlisted applicants. Positions are
// computed live from queued_at (ROW_NUMBER in WalkInsStore.Enqueue), so the
// timestamps are staggered rather than identical. Returns the promoted users,
// who are now accepted and therefore eligible to check in.
func seedWalkIns(db *sql.DB, superAdminIDs []string, byIndex map[int]seededApp, tl timeline) (promoted []seededApp) {
	tx := mustBegin(db)

	for n := 0; n < walkInCount; n++ {
		app, ok := byIndex[walkInStartIndex+n]
		if !ok {
			continue
		}

		queuedAt := tl.eventStart.Add(time.Duration(30+n*17) * time.Minute)

		if n < walkInPromoted {
			promotedAt := queuedAt.Add(time.Duration(20+n*10) * time.Minute)
			mustExec(tx, "insert promoted walk-in",
				`INSERT INTO walk_ins (user_id, queued_at, promoted_at, promoted_by) VALUES ($1, $2, $3, $4)`,
				app.UserID, queuedAt, promotedAt, superAdminIDs[n%len(superAdminIDs)])
			mustExec(tx, "accept promoted walk-in",
				`UPDATE applications SET status = 'accepted' WHERE id = $1`, app.ID)
			promoted = append(promoted, app)
			continue
		}

		mustExec(tx, "insert queued walk-in",
			`INSERT INTO walk_ins (user_id, queued_at) VALUES ($1, $2)`, app.UserID, queuedAt)
	}

	mustCommit(tx, "walk-ins")
	log.Printf("  inserted %d walk-ins (%d promoted, %d still queued)",
		walkInCount, len(promoted), walkInCount-len(promoted))
	return promoted
}

// seedScans records door traffic for everyone who actually showed up: accepted
// hackers who confirmed their RSVP, plus the walk-ins who were let in.
func seedScans(db *sql.DB, staffIDs []string, byIndex map[int]seededApp, promoted []seededApp, tl timeline) []seededApp {
	tx := mustBegin(db)

	// The event straddles now, so nothing may be scanned into the future.
	scanWindowEnd := tl.eventEnd
	if tl.now.Before(scanWindowEnd) {
		scanWindowEnd = tl.now
	}

	count := 0
	record := func(userID, scanType string, points int, repeatable bool, at time.Time) {
		mustExec(tx, "insert scan",
			`INSERT INTO scans (user_id, scan_type, scanned_by, points, repeatable, scanned_at, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
			userID, scanType, pick(staffIDs), points, repeatable, at)
		count++
	}

	// The whole walk-in queue got scanned at the door, promoted or not — that
	// walk_in scan is what puts someone in the queue in the first place.
	for n := 0; n < walkInCount; n++ {
		app, ok := byIndex[walkInStartIndex+n]
		if !ok {
			continue
		}
		record(app.UserID, "walk_in", 0, false, tl.eventStart.Add(time.Duration(28+n*17)*time.Minute))
	}

	var checkedIn []seededApp
	for i := 80; i < 120; i++ {
		if app, ok := byIndex[i]; ok {
			checkedIn = append(checkedIn, app)
		}
	}
	checkedIn = append(checkedIn, promoted...)

	for _, app := range checkedIn {
		checkInAt := between(tl.eventStart, tl.eventStart.Add(3*time.Hour))
		if checkInAt.After(scanWindowEnd) {
			checkInAt = scanWindowEnd
		}
		record(app.UserID, "check_in", 0, false, checkInAt)

		balance := 0
		award := func(scanType string) {
			at := between(checkInAt, scanWindowEnd)
			pts := scanTypePoints(scanType)
			record(app.UserID, scanType, pts, false, at)
			balance += pts
		}

		// 2-5 meals, drawn without replacement: the non-repeatable unique index
		// uq_scans_user_scan_type_once forbids a second row per (user, type).
		mealPerm := rng.Perm(len(mealScanTypes))
		for m := 0; m < 2+rng.Intn(4); m++ {
			award(mealScanTypes[mealPerm[m]])
		}

		if chance(70) {
			award("swag_tshirt")
		}
		if chance(50) {
			award("swag_sticker_pack")
		}

		workshopPerm := rng.Perm(len(workshopScanTypes))
		for w := 0; w < rng.Intn(len(workshopScanTypes)+1); w++ {
			award(workshopScanTypes[workshopPerm[w]])
		}

		if chance(35) {
			award("minigame_win")
		}

		// Shop scans spend points and are the only repeatable rows, matching
		// CreatePurchase. Only redeem what the balance actually covers, so the
		// seeded data satisfies the same invariant the handler enforces.
		shopPerm := rng.Perm(len(shopScanTypes))
		for s := 0; s < len(shopScanTypes) && chance(40); s++ {
			cost := scanTypePoints(shopScanTypes[shopPerm[s]])
			if balance < cost {
				continue
			}
			record(app.UserID, shopScanTypes[shopPerm[s]], -cost, true, between(checkInAt, scanWindowEnd))
			balance -= cost
		}
	}

	mustCommit(tx, "scans")
	log.Printf("  inserted %d scans (%d hackers checked in)", count, len(checkedIn))
	return checkedIn
}

// seedMealGroups mirrors what assignMealGroup does at check-in time: a group is
// handed out only once a hacker is actually through the door.
func seedMealGroups(db *sql.DB, checkedIn []seededApp) {
	groups := []string{"A", "B", "C", "D"}

	tx := mustBegin(db)
	for i, app := range checkedIn {
		mustExec(tx, "assign meal group",
			`UPDATE applications SET meal_group = $2 WHERE id = $1`, app.ID, groups[i%len(groups)])
	}
	mustCommit(tx, "meal groups")
	log.Printf("  assigned meal groups to %d hackers", len(checkedIn))
}
