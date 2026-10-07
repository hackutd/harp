package store

import (
	"context"
	"testing"
	"time"
)

func TestIntegrationAttendeeDirectory(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	ctx := context.Background()
	seedIntegration(t, db)

	const (
		alice = "11111111-1111-1111-1111-111111111111" // accepted + confirmed
		bob   = "22222222-2222-2222-2222-222222222222"
		carol = "33333333-3333-3333-3333-333333333333"
	)
	// Make bob and carol confirmed attendees too.
	if _, err := db.ExecContext(ctx, `UPDATE applications SET status = 'accepted', rsvp_status = 'confirmed',
		rsvp_responses = '{"discord_username":"bob_rsvp"}' WHERE user_id IN ($1, $2)`, bob, carol); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO scans (user_id, scan_type, scanned_by) VALUES ($1, 'check_in', '44444444-4444-4444-4444-444444444444')`, carol); err != nil {
		t.Fatal(err)
	}

	dir := &AttendeeDirectoryStore{db: db}

	eligible, err := dir.IsEligible(ctx, alice)
	if err != nil || !eligible {
		t.Fatalf("alice eligible: %v %v", eligible, err)
	}
	if eligible, _ := dir.IsEligible(ctx, "44444444-4444-4444-4444-444444444444"); eligible {
		t.Fatal("admin without application should not be eligible")
	}

	spots := 2
	for _, p := range []*DirectoryProfile{
		{UserID: alice, DisplayName: "Alice", Skills: StringArray{"Go"}, InterestTags: StringArray{"AI/ML"}, Intent: DirectoryIntentLookingForTeammates, Discoverable: true},
		{UserID: bob, DisplayName: "Bob", Skills: StringArray{"React", "Figma"}, InterestTags: StringArray{"Design"}, Intent: DirectoryIntentPartialTeam, SpotsNeeded: &spots, Discoverable: true},
		{UserID: carol, DisplayName: "Carol", Intent: DirectoryIntentJustNetworking, Discoverable: true},
	} {
		if _, err := dir.UpsertProfile(ctx, p); err != nil {
			t.Fatalf("upsert %s: %v", p.DisplayName, err)
		}
	}

	viewer := DirectoryViewer{UserID: alice, CheckInTypes: []string{"check_in"}}
	list := func(f DirectoryFilters) []DirectoryCard {
		t.Helper()
		res, err := dir.List(ctx, viewer, f, nil, 10)
		if err != nil {
			t.Fatal(err)
		}
		return res.Cards
	}

	if cards := list(DirectoryFilters{}); len(cards) != 2 {
		t.Fatalf("browse should exclude self: got %d", len(cards))
	}
	if cards := list(DirectoryFilters{Search: "fig"}); len(cards) != 1 || cards[0].UserID != bob {
		t.Fatalf("skill search: %+v", cards)
	}
	if cards := list(DirectoryFilters{CheckedIn: true}); len(cards) != 1 || cards[0].UserID != carol || !cards[0].CheckedIn {
		t.Fatalf("checked-in filter: %+v", cards)
	}
	if cards := list(DirectoryFilters{Intents: []DirectoryIntent{DirectoryIntentPartialTeam}, InterestTags: []string{"Design"}}); len(cards) != 1 {
		t.Fatalf("intent+tag filter: %+v", cards)
	}

	// Stale cards sort last once a cutoff applies.
	if _, err := db.ExecContext(ctx, `UPDATE attendee_directory_profiles SET status_confirmed_at = NOW() - INTERVAL '5 days' WHERE user_id = $1`, carol); err != nil {
		t.Fatal(err)
	}
	cutoff := time.Now().Add(-72 * time.Hour)
	staleViewer := viewer
	staleViewer.StaleCutoff = &cutoff
	page1, err := dir.List(ctx, staleViewer, DirectoryFilters{}, nil, 1)
	if err != nil || len(page1.Cards) != 1 || page1.Cards[0].UserID != bob || page1.NextCursor == nil {
		t.Fatalf("stale ordering page 1: %+v %v", page1, err)
	}
	cur, err := DecodeDirectoryCursor(*page1.NextCursor)
	if err != nil {
		t.Fatal(err)
	}
	page2, err := dir.List(ctx, staleViewer, DirectoryFilters{}, cur, 1)
	if err != nil || len(page2.Cards) != 1 || page2.Cards[0].UserID != carol || !page2.Cards[0].Stale || page2.NextCursor != nil {
		t.Fatalf("stale ordering page 2: %+v %v", page2, err)
	}

	// Hide and unhide.
	if err := dir.Hide(ctx, alice, bob); err != nil {
		t.Fatal(err)
	}
	if cards := list(DirectoryFilters{}); len(cards) != 1 {
		t.Fatalf("hidden card still listed: %+v", cards)
	}
	if cards := list(DirectoryFilters{Hidden: true}); len(cards) != 1 || cards[0].UserID != bob || !cards[0].IsHidden {
		t.Fatalf("hidden list: %+v", cards)
	}
	if err := dir.Unhide(ctx, alice, bob); err != nil {
		t.Fatal(err)
	}

	// Poke: one-way, saves a contact, no Discord yet.
	res, err := dir.Poke(ctx, alice, bob)
	if err != nil || !res.Created || res.Matched {
		t.Fatalf("first poke: %+v %v", res, err)
	}
	if res, _ := dir.Poke(ctx, alice, bob); res.Created {
		t.Fatal("repeat poke should be a no-op")
	}
	contacts, err := dir.ListContacts(ctx, viewer)
	if err != nil || len(contacts) != 1 || contacts[0].UserID != bob || contacts[0].DiscordUsername != nil {
		t.Fatalf("contacts after poke: %+v %v", contacts, err)
	}
	bobViewer := DirectoryViewer{UserID: bob}
	pokes, err := dir.ListPokedMe(ctx, bobViewer)
	if err != nil || len(pokes) != 1 || pokes[0].UserID != alice || !pokes[0].PokedMe || pokes[0].Matched {
		t.Fatalf("bob's pokes: %+v %v", pokes, err)
	}

	// Alice goes undiscoverable: gone from browse, but bob can still poke back.
	if err := dir.SetDiscoverable(ctx, alice, false); err != nil {
		t.Fatal(err)
	}
	if cards, _ := dir.List(ctx, bobViewer, DirectoryFilters{}, nil, 10); len(cards.Cards) != 1 || cards.Cards[0].UserID != carol {
		t.Fatalf("undiscoverable card listed: %+v", cards.Cards)
	}
	target, err := dir.GetTarget(ctx, bob, alice)
	if err != nil || target.Discoverable || !target.PokedViewer {
		t.Fatalf("target state: %+v %v", target, err)
	}
	res, err = dir.Poke(ctx, bob, alice)
	if err != nil || !res.Matched {
		t.Fatalf("poke back: %+v %v", res, err)
	}

	// Match reveals Discord, falling back to the RSVP username.
	contacts, _ = dir.ListContacts(ctx, viewer)
	if len(contacts) != 1 || !contacts[0].Matched || contacts[0].DiscordUsername == nil || *contacts[0].DiscordUsername != "bob_rsvp" {
		t.Fatalf("match reveal: %+v", contacts)
	}
	discordID, discordName := "42", "bob_oauth"
	if err := dir.SetDiscord(ctx, bob, &discordID, &discordName); err != nil {
		t.Fatal(err)
	}
	card, err := dir.GetCard(ctx, viewer, bob)
	if err != nil || card.DiscordUserID == nil || *card.DiscordUserID != "42" || *card.DiscordUsername != "bob_oauth" {
		t.Fatalf("oauth discord: %+v %v", card, err)
	}
	// Carol never matched, so her Discord stays private.
	if err := dir.SetDiscord(ctx, carol, &discordID, &discordName); err != nil {
		t.Fatal(err)
	}
	if card, _ := dir.GetCard(ctx, viewer, carol); card.DiscordUserID != nil || card.DiscordUsername != nil {
		t.Fatalf("unmatched discord leaked: %+v", card)
	}

	// Saving the card again keeps discoverable off and re-confirms status.
	before, _ := dir.GetProfile(ctx, alice)
	updated, err := dir.UpsertProfile(ctx, &DirectoryProfile{UserID: alice, DisplayName: "Alice N", Intent: DirectoryIntentTeamSet, Discoverable: true})
	if err != nil || updated.Discoverable || !updated.StatusConfirmedAt.After(before.StatusConfirmedAt) {
		t.Fatalf("upsert kept privacy: %+v %v", updated, err)
	}

	// Moderation removes bob from contacts and browse.
	if err := dir.SetModeration(ctx, bob, "44444444-4444-4444-4444-444444444444", true, nil); err != nil {
		t.Fatal(err)
	}
	if contacts, _ := dir.ListContacts(ctx, viewer); len(contacts) != 0 {
		t.Fatalf("moderated contact still listed: %+v", contacts)
	}
	admin, err := dir.AdminList(ctx, "bob@", 10)
	if err != nil || len(admin) != 1 || admin[0].ModerationHiddenAt == nil {
		t.Fatalf("admin list: %+v %v", admin, err)
	}
	if err := dir.SetModeration(ctx, "55555555-5555-5555-5555-555555555555", alice, true, nil); err != ErrNotFound {
		t.Fatalf("moderating a missing card: %v", err)
	}

	// Push targeting by user.
	push := &PushSubscriptionsStore{db: db}
	if err := push.Upsert(ctx, &PushSubscription{UserID: bob, Endpoint: "https://fcm.googleapis.com/x", P256dh: "p", Auth: "a"}); err != nil {
		t.Fatal(err)
	}
	subs, err := push.ListByUserIDs(ctx, []string{bob, carol})
	if err != nil || len(subs) != 1 {
		t.Fatalf("push by user: %+v %v", subs, err)
	}
}
