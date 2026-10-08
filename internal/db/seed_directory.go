package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"slices"
	"strings"
	"time"

	"github.com/hackutd/harp/internal/store"
)

// directoryStaleAfter mirrors the API's cutoff (cmd/api/directory.go): close to
// the event, a card whose status was last confirmed longer ago than this is
// shown as stale and sorts after the fresh ones.
const directoryStaleAfter = 72 * time.Hour

// dirCard is what the relationship phase needs to know about a seeded card.
type dirCard struct {
	userID    string
	createdAt time.Time
	// visible cards show up in browse: eligible, discoverable, unmoderated.
	visible bool
	// canAct cards belong to someone the API would let poke and save:
	// eligible and unmoderated, whether or not they are discoverable.
	canAct bool
}

// dirApplicant is the application data a card is built from, so the card's
// name, links, and Discord agree with what the hacker submitted.
type dirApplicant struct {
	first, last     string
	github          string
	linkedin        string
	discord         string
	rsvpSubmittedAt *time.Time
}

const insertDirectoryProfileQuery = `
	INSERT INTO attendee_directory_profiles (
		user_id, display_name, pronouns, skills, interest_tags,
		roles_looking_for, icebreaker_prompt, icebreaker_answer, want_to_build,
		github_username, linkedin_handle, experiences,
		intent, spots_needed, discoverable, status_confirmed_at,
		discord_user_id, discord_username,
		moderation_hidden_at, moderation_hidden_by, moderation_reason,
		created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5,
		$6, $7, $8, $9,
		$10, $11, $12,
		$13, $14, $15, $16,
		$17, $18,
		$19, $20, $21,
		$22, $16
	)
`

// seedDirectory fills the attendee directory. Cards go to the hackers the API
// would let make one (accepted + confirmed RSVP), with a few deliberate edge
// cases: some confirmed hackers never made a card, some hid theirs, two were
// moderated, a fifth are stale, and two declined their RSVP after making one
// (still in moderation, gone from browse). Pokes, matches, saved contacts,
// and hidden cards are then spread among them, and aimed at every real
// account that already has a card, since seeded users can't log in to see
// any of it.
//
// All of it hangs off seeded users, so clean() removes it through ON DELETE
// CASCADE; a real account's own card and its pokes with other real accounts
// are left alone.
func seedDirectory(db *sql.DB, superAdminIDs []string, apps []seededApp, tl timeline) {
	tags := loadDirectoryInterestTags(db)

	var eligible, declined []seededApp
	for _, a := range apps {
		if a.plan.Status != "accepted" {
			continue
		}
		switch a.plan.RSVPStatus {
		case "confirmed":
			eligible = append(eligible, a)
		case "declined":
			declined = append(declined, a)
		}
	}

	// Every 12th confirmed hacker never got around to making a card.
	var holders []seededApp
	for k, a := range eligible {
		if k%12 != 11 {
			holders = append(holders, a)
		}
	}
	rng.Shuffle(len(holders), func(i, j int) { holders[i], holders[j] = holders[j], holders[i] })

	const moderated, undiscoverable = 2, 4
	withCards := append(append([]seededApp(nil), holders...), declined[:2]...)
	applicants := loadDirectoryApplicants(db, withCards)

	tx := mustBegin(db)
	cards := make([]dirCard, 0, len(withCards))
	stale := 0
	for k, a := range withCards {
		isEligible := k < len(holders)
		isModerated := isEligible && k < moderated
		discoverable := !isEligible || k >= moderated+undiscoverable

		card, isStale := insertDirectoryCard(tx, a.UserID, applicants[a.UserID], tags, tl,
			discoverable, isModerated, superAdminIDs)
		card.visible = isEligible && discoverable && !isModerated
		card.canAct = isEligible && !isModerated
		cards = append(cards, card)
		if isStale && card.visible {
			stale++
		}
	}
	mustCommit(tx, "directory profiles")
	log.Printf("  inserted %d directory cards (%d confirmed hackers without one, %d hidden by their owner, %d moderated, %d stale, %d after declining)",
		len(cards), len(eligible)-len(holders), undiscoverable, moderated, stale, len(cards)-len(holders))

	rel := newDirRelations(tl)
	tx = mustBegin(db)
	seedDirectoryGraph(tx, rel, cards)
	seedDirectoryForRealUsers(db, tx, rel, cards)
	mustCommit(tx, "directory relationships")
}

// loadDirectoryInterestTags reads the tag list the card editor offers, so every
// seeded tag is one a hacker could have picked.
func loadDirectoryInterestTags(db *sql.DB) []string {
	var raw []byte
	err := db.QueryRow(`SELECT value FROM settings WHERE key = $1`, store.SettingsKeyDirectoryInterestTags).Scan(&raw)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Fatalf("failed to read directory interest tags: %v", err)
	}
	var tags []string
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &tags); err != nil {
			log.Fatalf("failed to parse directory interest tags: %v", err)
		}
	}
	return tags
}

func loadDirectoryApplicants(db *sql.DB, apps []seededApp) map[string]dirApplicant {
	ids := make(store.StringArray, len(apps))
	for i, a := range apps {
		ids[i] = a.UserID
	}

	rows, err := db.Query(`
		SELECT user_id,
		       COALESCE(responses->>'first_name', ''), COALESCE(responses->>'last_name', ''),
		       COALESCE(responses->>'github', ''), COALESCE(responses->>'linkedin', ''),
		       COALESCE(rsvp_responses->>'discord_username', ''), rsvp_submitted_at
		FROM applications
		WHERE user_id = ANY($1::uuid[])`, ids)
	if err != nil {
		log.Fatalf("failed to read directory applicants: %v", err)
	}
	defer rows.Close()

	out := make(map[string]dirApplicant, len(apps))
	for rows.Next() {
		var id string
		var a dirApplicant
		if err := rows.Scan(&id, &a.first, &a.last, &a.github, &a.linkedin, &a.discord, &a.rsvpSubmittedAt); err != nil {
			log.Fatalf("failed to scan directory applicant: %v", err)
		}
		out[id] = a
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("failed to read directory applicants: %v", err)
	}
	return out
}

func insertDirectoryCard(tx *sql.Tx, userID string, a dirApplicant, tags []string, tl timeline,
	discoverable, moderated bool, superAdminIDs []string) (dirCard, bool) {
	persona := pick(directoryPersonas)

	// A card can only be made after the RSVP that unlocks it.
	earliest := tl.now.AddDate(0, 0, -7)
	if a.rsvpSubmittedAt != nil && a.rsvpSubmittedAt.After(earliest) {
		earliest = *a.rsvpSubmittedAt
	}
	staleBefore := tl.now.Add(-directoryStaleAfter)

	var createdAt, confirmedAt time.Time
	isStale := chance(20) && earliest.Before(staleBefore.Add(-8*time.Hour))
	if isStale {
		createdAt = between(earliest, staleBefore.Add(-8*time.Hour))
		confirmedAt = between(createdAt, staleBefore.Add(-time.Hour))
	} else {
		createdAt = between(earliest, tl.now.Add(-time.Hour))
		from := staleBefore.Add(2 * time.Hour)
		if createdAt.After(from) {
			from = createdAt
		}
		confirmedAt = between(from, tl.now.Add(-5*time.Minute))
	}

	intent := store.DirectoryIntentLookingForTeammates
	switch n := rng.Intn(100); {
	case n < 25:
		intent = store.DirectoryIntentPartialTeam
	case n < 45:
		intent = store.DirectoryIntentTeamSet
	case n < 60:
		intent = store.DirectoryIntentJustNetworking
	}
	var spots *int
	roles := store.StringArray{}
	if intent == store.DirectoryIntentPartialTeam {
		spots = ptr(1 + rng.Intn(3))
	}
	if intent == store.DirectoryIntentLookingForTeammates || intent == store.DirectoryIntentPartialTeam {
		for _, r := range sample(persona.seeks, 1+rng.Intn(3)) {
			if slices.Contains(store.DirectoryRoles, r) {
				roles = append(roles, r)
			}
		}
	}

	skills := store.StringArray{}
	if chance(90) {
		skills = sample(persona.skills, 1+rng.Intn(3))
	}

	interests := store.StringArray{}
	for _, t := range sample(persona.tags, 2+rng.Intn(4)) {
		if slices.Contains(tags, t) {
			interests = append(interests, t)
		}
	}
	if len(interests) == 0 && len(tags) > 0 {
		interests = sample(tags, 2)
	}

	var prompt, answer *string
	if chance(75) {
		p := pick(directoryIcebreakerPrompts())
		prompt, answer = ptr(p), ptr(pick(directoryIcebreakers[p]))
	}

	var wantToBuild *string
	if chance(65) {
		wantToBuild = ptr(pick(persona.builds))
	}

	var pronouns *string
	if chance(60) {
		pronouns = ptr(pick(directoryPronouns))
	}

	var github, linkedin *string
	if h := strings.TrimPrefix(a.github, "https://github.com/"); h != "" && h != a.github && chance(75) {
		github = ptr(h)
	}
	if h := strings.TrimPrefix(a.linkedin, "https://linkedin.com/in/"); h != "" && h != a.linkedin && chance(60) {
		linkedin = ptr(h)
	}

	// Mostly zero to three past roles, occasionally up to the five allowed.
	n := []int{0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5}[rng.Intn(12)]
	experiences := store.DirectoryExperiences{}
	for _, company := range sample(persona.companies, n) {
		experiences = append(experiences, store.DirectoryExperience{Company: company, Title: pick(persona.titles)})
	}

	// Some linked Discord through OAuth; the rest fall back to the handle on
	// their RSVP, which only a match ever sees.
	var discordID, discordName *string
	if a.discord != "" && chance(40) {
		discordID = ptr(fmt.Sprintf("%d", 100000000000000000+rng.Int63n(900000000000000000)))
		discordName = ptr(a.discord)
	}

	var hiddenAt *time.Time
	var hiddenBy, reason *string
	if moderated {
		hiddenAt = ptr(between(confirmedAt, tl.now))
		hiddenBy = ptr(pick(superAdminIDs))
		reason = ptr(pick(directoryModerationReasons))
	}

	name := strings.TrimSpace(a.first + " " + a.last)
	if name == "" {
		name = "Hacker"
	}

	mustExec(tx, "insert directory profile", insertDirectoryProfileQuery,
		userID, name, pronouns, skills, interests,
		roles, prompt, answer, wantToBuild,
		github, linkedin, experiences,
		intent, spots, discoverable, confirmedAt,
		discordID, discordName,
		hiddenAt, hiddenBy, reason,
		createdAt,
	)
	return dirCard{userID: userID, createdAt: createdAt}, isStale
}

// directoryIcebreakerPrompts lists the prompts in a stable order; ranging over
// the map directly would make the seed nondeterministic.
func directoryIcebreakerPrompts() []string {
	prompts := make([]string, 0, len(directoryIcebreakers))
	for p := range directoryIcebreakers {
		prompts = append(prompts, p)
	}
	slices.Sort(prompts)
	return prompts
}

// sample returns up to n distinct elements of opts in random order.
func sample(opts []string, n int) store.StringArray {
	if n > len(opts) {
		n = len(opts)
	}
	out := make(store.StringArray, n)
	for i, j := range rng.Perm(len(opts))[:n] {
		out[i] = opts[j]
	}
	return out
}

// dirRelations writes pokes, contacts, and hides with the same side effects
// the API has, and remembers what it wrote so nothing is inserted twice.
type dirRelations struct {
	tl       timeline
	pokes    map[[2]string]bool
	contacts map[[2]string]bool
	hidden   map[[2]string]bool
	created  map[string]time.Time
	counts   struct{ pokes, matches, contacts, hidden int }
}

func newDirRelations(tl timeline) *dirRelations {
	return &dirRelations{
		tl:       tl,
		pokes:    map[[2]string]bool{},
		contacts: map[[2]string]bool{},
		hidden:   map[[2]string]bool{},
		created:  map[string]time.Time{},
	}
}

func (r *dirRelations) related(a, b string) bool {
	return r.pokes[[2]string{a, b}] || r.contacts[[2]string{a, b}] || r.hidden[[2]string{a, b}]
}

// after returns a random time once both cards exist.
func (r *dirRelations) after(a, b string) time.Time {
	lo := r.created[a]
	if r.created[b].After(lo) {
		lo = r.created[b]
	}
	return between(lo, r.tl.now.Add(-time.Minute))
}

func (r *dirRelations) contact(tx *sql.Tx, owner, contact string, at time.Time) {
	key := [2]string{owner, contact}
	if r.contacts[key] {
		return
	}
	r.contacts[key] = true
	r.counts.contacts++
	mustExec(tx, "insert directory contact",
		`INSERT INTO directory_contacts (owner_id, contact_id, created_at) VALUES ($1, $2, $3)`, owner, contact, at)
}

// poke records poker -> pokee at the given time. Like the API, poking saves
// the pokee to the poker's contacts.
func (r *dirRelations) poke(tx *sql.Tx, poker, pokee string, at time.Time, seenAt *time.Time) {
	r.pokes[[2]string{poker, pokee}] = true
	r.counts.pokes++
	mustExec(tx, "insert poke",
		`INSERT INTO pokes (poker_id, pokee_id, created_at, seen_at) VALUES ($1, $2, $3, $4)`,
		poker, pokee, at, seenAt)
	r.contact(tx, poker, pokee, at)
}

// match has first poke second, then second poke back. The poke back is what
// marks the first poke seen; whether the poke back was seen is up to the
// caller, since an unseen one is what puts a new match on the badge.
func (r *dirRelations) match(tx *sql.Tx, first, second string, backSeen bool) {
	t1 := r.after(first, second)
	t2 := between(t1, r.tl.now.Add(-time.Minute))
	r.poke(tx, first, second, t1, &t2)
	var seen *time.Time
	if backSeen {
		seen = ptr(between(t2, r.tl.now))
	}
	r.poke(tx, second, first, t2, seen)
	r.counts.matches++
}

func (r *dirRelations) hide(tx *sql.Tx, owner, hidden string) {
	r.hidden[[2]string{owner, hidden}] = true
	r.counts.hidden++
	mustExec(tx, "insert hidden directory card",
		`INSERT INTO directory_hidden_profiles (owner_id, hidden_id, created_at) VALUES ($1, $2, $3)`,
		owner, hidden, r.after(owner, hidden))
}

// seedDirectoryGraph spreads pokes, matches, contacts, and hides among seeded
// cards. Only cards the API would let act do the poking, and only browsable
// cards get poked first -- a poke back is allowed to a hidden card, because
// its owner poked first.
func seedDirectoryGraph(tx *sql.Tx, r *dirRelations, cards []dirCard) {
	var actors, targets []string
	for _, c := range cards {
		r.created[c.userID] = c.createdAt
		if c.canAct {
			actors = append(actors, c.userID)
		}
		if c.visible {
			targets = append(targets, c.userID)
		}
	}
	if len(actors) == 0 || len(targets) < 2 {
		return
	}

	for n := 0; n < 160; n++ {
		a, b := pick(actors), pick(targets)
		if a == b || r.related(a, b) || r.related(b, a) {
			continue
		}
		if chance(35) {
			r.match(tx, a, b, chance(60))
			continue
		}
		at := r.after(a, b)
		var seen *time.Time
		if chance(55) {
			seen = ptr(between(at, r.tl.now))
		}
		r.poke(tx, a, b, at, seen)
	}

	for n := 0; n < 50; n++ {
		a, b := pick(actors), pick(targets)
		if a != b && !r.related(a, b) {
			r.contact(tx, a, b, r.after(a, b))
		}
	}

	for n := 0; n < 20; n++ {
		a, b := pick(actors), pick(targets)
		if a != b && !r.related(a, b) && !r.related(b, a) {
			r.hide(tx, a, b)
		}
	}

	log.Printf("  inserted %d pokes (%d matches), %d contacts, %d hidden cards between seeded hackers",
		r.counts.pokes, r.counts.matches, r.counts.contacts, r.counts.hidden)
}

// seedDirectoryForRealUsers gives each real account that already has a card
// something to look at: matches (two of them fresh, still on the badge),
// unseen and seen incoming pokes, pokes still waiting on a reply, saved
// contacts, and hidden cards. Seeded users can't sign in, so this is the only
// way the Poked you, Contacts, and match screens show anything.
func seedDirectoryForRealUsers(db *sql.DB, tx *sql.Tx, r *dirRelations, cards []dirCard) {
	rows, err := db.Query(`
		SELECT u.id, u.email, p.created_at, p.discoverable, p.moderation_hidden_at IS NOT NULL,
		       EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id
		               AND a.status = 'accepted' AND a.rsvp_status = 'confirmed')
		FROM users u
		JOIN attendee_directory_profiles p ON p.user_id = u.id
		WHERE u.supertokens_user_id NOT LIKE $1
		ORDER BY u.email`, seedUserPrefix+"%")
	if err != nil {
		log.Fatalf("failed to read real directory users: %v", err)
	}
	type realUser struct {
		id, email    string
		created      time.Time
		discoverable bool
		ok           bool
	}
	var users []realUser
	for rows.Next() {
		var u realUser
		var moderated, eligible bool
		if err := rows.Scan(&u.id, &u.email, &u.created, &u.discoverable, &moderated, &eligible); err != nil {
			log.Fatalf("failed to scan real directory user: %v", err)
		}
		u.ok = eligible && !moderated
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("failed to read real directory users: %v", err)
	}
	rows.Close()

	if len(users) == 0 {
		log.Println("  no real account has a directory card — make one at /app/directory, then re-run the seed")
		log.Println("    to get matches, pokes, and contacts aimed at you.")
		return
	}

	var visible, quiet []string
	for _, c := range cards {
		if c.visible {
			visible = append(visible, c.userID)
		} else if c.canAct {
			quiet = append(quiet, c.userID)
		}
	}

	for _, u := range users {
		if !u.ok {
			log.Printf("  skipped %s: needs an accepted application, a confirmed RSVP, and an unmoderated card", u.email)
			continue
		}
		r.created[u.id] = u.created
		pool := append([]string(nil), visible...)
		rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
		take := func(n int) []string {
			n = min(n, len(pool))
			// Capped so appending to one batch can't write into the next.
			out := pool[:n:n]
			pool = pool[n:]
			return out
		}

		matches := take(6)
		for k, s := range matches {
			// Two matches start with the real user and end with an unseen poke
			// back, so the badge has a fresh match on it. Nobody can poke an
			// undiscoverable card first, so those all start with the real user.
			if k < 2 || !u.discoverable {
				r.match(tx, u.id, s, false)
			} else {
				r.match(tx, s, u.id, chance(50))
			}
		}

		// Pokes nobody has answered yet. Someone who has since hidden their
		// own card still shows up under Poked you.
		var unseen, seen []string
		if u.discoverable {
			unseen = take(5)
			if len(quiet) > 0 {
				unseen = append(unseen, pick(quiet))
			}
			seen = take(3)
		}
		for _, s := range unseen {
			r.poke(tx, s, u.id, r.after(s, u.id), nil)
		}
		for _, s := range seen {
			at := r.after(s, u.id)
			r.poke(tx, s, u.id, at, ptr(between(at, r.tl.now)))
		}

		sent := take(4)
		for _, s := range sent {
			at := r.after(u.id, s)
			var seenAt *time.Time
			if chance(50) {
				seenAt = ptr(between(at, r.tl.now))
			}
			r.poke(tx, u.id, s, at, seenAt)
		}
		saved := take(3)
		for _, s := range saved {
			r.contact(tx, u.id, s, r.after(u.id, s))
		}
		hidden := take(2)
		for _, s := range hidden {
			r.hide(tx, u.id, s)
		}

		log.Printf("  gave %s %d matches, %d unanswered pokes (%d unseen), %d sent pokes, %d saved contacts, %d hidden cards",
			u.email, len(matches), len(unseen)+len(seen), len(unseen), len(sent), len(saved), len(hidden))
		if !u.discoverable {
			log.Printf("    %s's card isn't discoverable, so nobody could poke it first — skipped incoming pokes", u.email)
		}
	}
}
