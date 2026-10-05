package db

import (
	"database/sql"
	"log"

	"github.com/hackutd/harp/internal/store"
)

const upsertSettingQuery = `
	INSERT INTO settings (key, value)
	VALUES ($1, $2::jsonb)
	ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
`

// seedSettings fills in the operator configuration. Two groups matter for
// different reasons:
//
//   - The onboarding five (hackathon name, date range, application due date,
//     contact email, from email) ship as JSONB null from migration 000028.
//     Until they are set, getOnboardingStatus reports complete:false and
//     OnboardingGate blocks the entire admin UI — so without this the rest of
//     the seed is unreachable.
//   - rsvp_enabled and travel_rsvp_enabled have no seed migration at all, so
//     their rows simply do not exist yet.
//
// The three form schemas (application_schema, rsvp_schema, travel_rsvp_schema)
// are deliberately left alone: migrations 000006/000035/000040 own them, and
// every seeded response is keyed to those exact field ids.
func seedSettings(db *sql.DB, superAdminIDs []string, tl timeline) {
	tx := mustBegin(db)

	set := func(key string, value any) {
		mustExec(tx, "upsert setting "+key, upsertSettingQuery, key, mustJSON(value))
	}

	dateOnly := "2006-01-02"

	// Hackathon identity — the onboarding gate reads these.
	set(store.SettingsKeyHackathonName, "HackUTD Seed Edition")
	set(store.SettingsKeyContactEmail, "hello@hackutd.co")
	set(store.SettingsKeyFromEmail, "noreply@hackutd.co")
	set(store.SettingsKeyFromName, "HackUTD")
	set(store.SettingsKeyApplicationDueDate, tl.appDue.Format(dateOnly))
	set(store.SettingsKeyHackathonDateRange, map[string]string{
		"start_date": tl.eventStart.Format(dateOnly),
		"end_date":   tl.eventEnd.Format(dateOnly),
	})

	// Legal links shown on the login page.
	set(store.SettingsKeyPrivacyPolicyURL, "https://example.com/privacy")
	set(store.SettingsKeyTermsURL, "https://example.com/terms")
	set(store.SettingsKeyHackerPackURL, "https://example.com/hacker-pack")

	// Form availability. applications_enabled is left open even though the due
	// date has passed, so the Forms settings tab renders its past-deadline
	// warning rather than an inert closed form.
	set(store.SettingsKeyApplicationsEnabled, true)
	set(store.SettingsKeyRSVPEnabled, true)
	set(store.SettingsKeyTravelRSVPEnabled, true)

	// Admin capability toggles.
	set(store.SettingsKeyAdminScheduleEditEnabled, true)
	set(store.SettingsKeyAdminSponsorEditEnabled, true)
	set(store.SettingsKeyAdminFAQEditEnabled, true)

	// Review configuration. One toggle is off on purpose so the user management
	// table shows both states.
	set(store.SettingsKeyReviewsPerApplication, 3)
	entries := make([]store.ReviewAssignmentEntry, 0, len(superAdminIDs))
	for i, id := range superAdminIDs {
		entries = append(entries, store.ReviewAssignmentEntry{ID: id, Enabled: i != 1})
	}
	set(store.SettingsKeyReviewAssignmentToggle, entries)

	// Points and scanning.
	set(store.SettingsKeyPointsEnabled, true)
	set(store.SettingsKeyPointsName, "Ripples")
	set(store.SettingsKeyMealGroups, []string{"A", "B", "C", "D"})
	set(store.SettingsKeyScanTypes, scanTypeSettingValue())

	mustCommit(tx, "settings")

	rebuildScanStats(db)
	log.Println("  wrote hackathon settings, scan types, and scan stats")
}

// scanTypeSettingValue renders seedScanTypes in the shape store.ScanType
// serializes to, so the saved value round-trips through the scan types editor
// unchanged.
func scanTypeSettingValue() []map[string]any {
	out := make([]map[string]any, 0, len(seedScanTypes))
	for _, t := range seedScanTypes {
		out = append(out, map[string]any{
			"name":         t.Name,
			"display_name": t.DisplayName,
			"category":     t.Category,
			"is_active":    t.IsActive,
			"points":       t.Points,
		})
	}
	return out
}

// rebuildScanStats recomputes the denormalized counter cache the same way
// ScansStore.RebalanceStats does, so the dashboard agrees with the scans table
// without an operator having to hit rebalance-stats first.
func rebuildScanStats(db *sql.DB) {
	rows, err := db.Query(`SELECT scan_type, COUNT(*) FROM scans GROUP BY scan_type`)
	if err != nil {
		log.Fatalf("failed to aggregate scan stats: %v", err)
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var scanType string
		var count int
		if err := rows.Scan(&scanType, &count); err != nil {
			log.Fatalf("failed to scan stat row: %v", err)
		}
		stats[scanType] = count
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("failed to read scan stats: %v", err)
	}

	if _, err := db.Exec(upsertSettingQuery, store.SettingsKeyScanStats, mustJSON(stats)); err != nil {
		log.Fatalf("failed to write scan stats: %v", err)
	}
}
