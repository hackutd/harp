package db

import (
	"database/sql"
	"errors"
	"fmt"
	"log"

	"github.com/hackutd/harp/internal/env"
)

const insertUserQuery = `
	INSERT INTO users (supertokens_user_id, email, role, auth_method, profile_picture_url)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id
`

type seedStaffMember struct {
	slug       string
	email      string
	role       string
	authMethod string
	avatar     *string
}

var seedStaffMembers = []seedStaffMember{
	{"superadmin-1", "superadmin@hackutd.co", "super_admin", "passwordless", nil},
	{"superadmin-2", "superadmin2@hackutd.co", "super_admin", "google", ptr("https://i.pravatar.cc/128?u=superadmin2")},
	{"admin-1", "admin1@hackutd.co", "admin", "passwordless", nil},
	{"admin-2", "admin2@hackutd.co", "admin", "google", ptr("https://i.pravatar.cc/128?u=admin2")},
	{"admin-3", "admin3@hackutd.co", "admin", "passwordless", nil},
	{"admin-4", "admin4@hackutd.co", "admin", "google", ptr("https://i.pravatar.cc/128?u=admin4")},
	{"admin-5", "admin5@hackutd.co", "admin", "passwordless", nil},
	{"admin-6", "admin6@hackutd.co", "admin", "google", nil},
}

// seedStaff inserts the organizing team. It returns every staff id (the review
// pool) and, separately, just the super admin ids -- walk-in promotions and
// notification authorship have to be attributed to a super admin.
func seedStaff(db *sql.DB) (staffIDs, superAdminIDs []string) {
	tx := mustBegin(db)

	for _, m := range seedStaffMembers {
		var id string
		err := tx.QueryRow(insertUserQuery,
			seedUserPrefix+m.slug, m.email, m.role, m.authMethod, m.avatar).Scan(&id)
		if err != nil {
			log.Fatalf("failed to insert staff user %s: %v", m.email, err)
		}
		staffIDs = append(staffIDs, id)
		if m.role == "super_admin" {
			superAdminIDs = append(superAdminIDs, id)
		}
	}

	mustCommit(tx, "staff users")
	log.Printf("  inserted %d staff users (%d super admin, %d admin)",
		len(staffIDs), len(superAdminIDs), len(staffIDs)-len(superAdminIDs))
	return staffIDs, superAdminIDs
}

func seedHackers(db *sql.DB, count int) []string {
	tx := mustBegin(db)

	ids := make([]string, 0, count)
	for i := 1; i <= count; i++ {
		authMethod := "passwordless"
		if i%4 == 0 {
			authMethod = "google"
		}

		var id string
		err := tx.QueryRow(insertUserQuery,
			fmt.Sprintf("%shacker-%d", seedUserPrefix, i),
			fmt.Sprintf("hacker%d@example.com", i),
			"hacker", authMethod, nil,
		).Scan(&id)
		if err != nil {
			log.Fatalf("failed to insert hacker %d: %v", i, err)
		}
		ids = append(ids, id)
	}

	mustCommit(tx, "hacker users")
	log.Printf("  inserted %d hackers", len(ids))
	return ids
}

// promoteRealSuperAdmin grants super_admin to an already-existing account named
// by SEED_SUPERADMIN_EMAIL. Seeded users carry fabricated supertokens_user_id
// values and therefore cannot log in, so without this there is no way to
// actually open the super admin UI against seeded data.
//
// Returns the promoted user id, or nothing when the variable is unset or the
// address matches no row.
func promoteRealSuperAdmin(db *sql.DB) []string {
	email := env.GetString("SEED_SUPERADMIN_EMAIL", "")
	if email == "" {
		log.Println("  SEED_SUPERADMIN_EMAIL not set — no real account was promoted.")
		log.Println("    Seeded users cannot log in (their SuperTokens ids are fake). Sign in once,")
		log.Println("    then re-run with SEED_SUPERADMIN_EMAIL=you@example.com to grant yourself super_admin.")
		return nil
	}

	var id string
	err := db.QueryRow(
		`UPDATE users SET role = 'super_admin' WHERE email = $1 RETURNING id`, email).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		log.Printf("  SEED_SUPERADMIN_EMAIL=%s matched no user — sign in once, then re-run the seed.", email)
		return nil
	}
	if err != nil {
		log.Fatalf("failed to promote %s: %v", email, err)
	}

	log.Printf("  promoted %s to super_admin", email)
	return []string{id}
}
