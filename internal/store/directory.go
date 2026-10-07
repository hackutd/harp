package store

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

type DirectoryIntent string

const (
	DirectoryIntentLookingForTeammates DirectoryIntent = "looking_for_teammates"
	DirectoryIntentPartialTeam         DirectoryIntent = "partial_team"
	DirectoryIntentTeamSet             DirectoryIntent = "team_set"
	DirectoryIntentOpenToCollab        DirectoryIntent = "open_to_collab"
	DirectoryIntentJustNetworking      DirectoryIntent = "just_networking"
)

// DirectoryRoles is the fixed set of roles a hacker can say they are looking for.
var DirectoryRoles = []string{
	"frontend", "backend", "fullstack", "mobile", "ml_ai", "data",
	"design", "hardware", "product", "pitch",
}

const SettingsKeyDirectoryInterestTags = "directory_interest_tags"

// DirectoryProfile is a hacker's own attendee directory card, as they edit it.
type DirectoryProfile struct {
	UserID            string          `json:"user_id"`
	DisplayName       string          `json:"display_name"`
	Pronouns          *string         `json:"pronouns"`
	HeadshotPath      *string         `json:"headshot_path"`
	Skills            StringArray     `json:"skills" swaggertype:"array,string"`
	InterestTags      StringArray     `json:"interest_tags" swaggertype:"array,string"`
	RolesLookingFor   StringArray     `json:"roles_looking_for" swaggertype:"array,string"`
	IcebreakerPrompt  *string         `json:"icebreaker_prompt"`
	IcebreakerAnswer  *string         `json:"icebreaker_answer"`
	WantToBuild       *string         `json:"want_to_build"`
	Intent            DirectoryIntent `json:"intent"`
	SpotsNeeded       *int            `json:"spots_needed"`
	Discoverable      bool            `json:"discoverable"`
	StatusConfirmedAt time.Time       `json:"status_confirmed_at"`
	DiscordUserID     *string         `json:"discord_user_id"`
	DiscordUsername   *string         `json:"discord_username"`
	ModerationHidden  bool            `json:"moderation_hidden"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// DirectoryCard is another attendee's card as seen by a viewer, with the
// viewer's relationship to them. Discord fields are only set once matched.
type DirectoryCard struct {
	UserID            string          `json:"user_id"`
	DisplayName       string          `json:"display_name"`
	Pronouns          *string         `json:"pronouns"`
	HeadshotPath      *string         `json:"-"`
	ProfilePictureURL *string         `json:"-"`
	HeadshotURL       *string         `json:"headshot_url"`
	Skills            StringArray     `json:"skills" swaggertype:"array,string"`
	InterestTags      StringArray     `json:"interest_tags" swaggertype:"array,string"`
	RolesLookingFor   StringArray     `json:"roles_looking_for" swaggertype:"array,string"`
	IcebreakerPrompt  *string         `json:"icebreaker_prompt"`
	IcebreakerAnswer  *string         `json:"icebreaker_answer"`
	WantToBuild       *string         `json:"want_to_build"`
	Intent            DirectoryIntent `json:"intent"`
	SpotsNeeded       *int            `json:"spots_needed"`
	StatusConfirmedAt time.Time       `json:"status_confirmed_at"`
	CheckedIn         bool            `json:"checked_in"`
	Stale             bool            `json:"stale"`
	PokedByMe         bool            `json:"poked_by_me"`
	PokedMe           bool            `json:"poked_me"`
	Matched           bool            `json:"matched"`
	IsContact         bool            `json:"is_contact"`
	IsHidden          bool            `json:"is_hidden"`
	DiscordUserID     *string         `json:"discord_user_id"`
	DiscordUsername   *string         `json:"discord_username"`
	// RelatedAt is when the viewer saved this contact or was poked, for lists.
	RelatedAt *time.Time `json:"related_at,omitempty"`
}

// DirectoryViewer carries what card queries need to know about who is looking.
type DirectoryViewer struct {
	UserID       string
	CheckInTypes []string
	// StaleCutoff, when set, marks cards confirmed before it as stale. It is
	// only set close to the event, when stale statuses start to matter.
	StaleCutoff *time.Time
}

type DirectoryFilters struct {
	Intents      []DirectoryIntent
	InterestTags []string
	Search       string
	CheckedIn    bool
	// Hidden lists the viewer's hidden cards instead of the regular feed.
	Hidden bool
}

type DirectoryCursor struct {
	Stale             bool
	StatusConfirmedAt time.Time
	UserID            string
}

type DirectoryListResult struct {
	Cards      []DirectoryCard
	NextCursor *string
}

// DirectoryTarget describes a card someone is trying to poke or save.
type DirectoryTarget struct {
	Discoverable     bool
	ModerationHidden bool
	Eligible         bool
	PokedViewer      bool
}

type PokeResult struct {
	Created bool
	Matched bool
}

// DirectoryAdminProfile is the moderation view of a directory card.
type DirectoryAdminProfile struct {
	UserID             string     `json:"user_id"`
	Email              string     `json:"email"`
	DisplayName        string     `json:"display_name"`
	Discoverable       bool       `json:"discoverable"`
	ModerationHiddenAt *time.Time `json:"moderation_hidden_at"`
	ModerationReason   *string    `json:"moderation_reason"`
	IcebreakerAnswer   *string    `json:"icebreaker_answer"`
	WantToBuild        *string    `json:"want_to_build"`
	CreatedAt          time.Time  `json:"created_at"`
	ModerationHiddenBy *string    `json:"moderation_hidden_by"`
}

func EncodeDirectoryCursor(c DirectoryCursor) string {
	stale := "0"
	if c.Stale {
		stale = "1"
	}
	raw := fmt.Sprintf("%s|%s|%s", stale, c.StatusConfirmedAt.UTC().Format(time.RFC3339Nano), c.UserID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func DecodeDirectoryCursor(encoded string) (*DirectoryCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("invalid cursor")
	}
	parts := strings.SplitN(string(raw), "|", 3)
	if len(parts) != 3 || (parts[0] != "0" && parts[0] != "1") || parts[2] == "" {
		return nil, errors.New("invalid cursor")
	}
	ts, err := time.Parse(time.RFC3339Nano, parts[1])
	if err != nil {
		return nil, errors.New("invalid cursor")
	}
	return &DirectoryCursor{Stale: parts[0] == "1", StatusConfirmedAt: ts, UserID: parts[2]}, nil
}

type AttendeeDirectoryStore struct {
	db *sql.DB
}

const directoryEligibleCondition = `a.status = 'accepted' AND a.rsvp_status = 'confirmed'`

// IsEligible reports whether a user has an accepted application with a
// confirmed RSVP, which is what lets them create a card and browse.
func (s *AttendeeDirectoryStore) IsEligible(ctx context.Context, userID string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var eligible bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM applications a
			WHERE a.user_id = $1 AND `+directoryEligibleCondition+`
		)`, userID).Scan(&eligible)
	return eligible, err
}

const directoryProfileColumns = `
	user_id, display_name, pronouns, headshot_path, skills, interest_tags,
	roles_looking_for, icebreaker_prompt, icebreaker_answer, want_to_build,
	intent, spots_needed, discoverable, status_confirmed_at, discord_user_id,
	discord_username, moderation_hidden_at IS NOT NULL, created_at, updated_at`

func scanDirectoryProfile(row interface{ Scan(...any) error }) (*DirectoryProfile, error) {
	var p DirectoryProfile
	err := row.Scan(
		&p.UserID, &p.DisplayName, &p.Pronouns, &p.HeadshotPath, &p.Skills, &p.InterestTags,
		&p.RolesLookingFor, &p.IcebreakerPrompt, &p.IcebreakerAnswer, &p.WantToBuild,
		&p.Intent, &p.SpotsNeeded, &p.Discoverable, &p.StatusConfirmedAt, &p.DiscordUserID,
		&p.DiscordUsername, &p.ModerationHidden, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if p.Skills == nil {
		p.Skills = StringArray{}
	}
	if p.InterestTags == nil {
		p.InterestTags = StringArray{}
	}
	if p.RolesLookingFor == nil {
		p.RolesLookingFor = StringArray{}
	}
	return &p, nil
}

func (s *AttendeeDirectoryStore) GetProfile(ctx context.Context, userID string) (*DirectoryProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	row := s.db.QueryRowContext(ctx,
		`SELECT `+directoryProfileColumns+` FROM attendee_directory_profiles WHERE user_id = $1`, userID)
	return scanDirectoryProfile(row)
}

// UpsertProfile creates or replaces the editable fields of a card. Saving
// counts as re-confirming the status. discoverable is only applied on create;
// afterwards it changes through SetDiscoverable so edits never flip privacy.
func (s *AttendeeDirectoryStore) UpsertProfile(ctx context.Context, p *DirectoryProfile) (*DirectoryProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	row := s.db.QueryRowContext(ctx, `
		INSERT INTO attendee_directory_profiles (
			user_id, display_name, pronouns, headshot_path, skills, interest_tags,
			roles_looking_for, icebreaker_prompt, icebreaker_answer, want_to_build,
			intent, spots_needed, discoverable
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (user_id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			pronouns = EXCLUDED.pronouns,
			headshot_path = EXCLUDED.headshot_path,
			skills = EXCLUDED.skills,
			interest_tags = EXCLUDED.interest_tags,
			roles_looking_for = EXCLUDED.roles_looking_for,
			icebreaker_prompt = EXCLUDED.icebreaker_prompt,
			icebreaker_answer = EXCLUDED.icebreaker_answer,
			want_to_build = EXCLUDED.want_to_build,
			intent = EXCLUDED.intent,
			spots_needed = EXCLUDED.spots_needed,
			status_confirmed_at = NOW()
		RETURNING `+directoryProfileColumns,
		p.UserID, p.DisplayName, p.Pronouns, p.HeadshotPath, nonNilArray(p.Skills), nonNilArray(p.InterestTags),
		nonNilArray(p.RolesLookingFor), p.IcebreakerPrompt, p.IcebreakerAnswer, p.WantToBuild,
		p.Intent, p.SpotsNeeded, p.Discoverable,
	)
	return scanDirectoryProfile(row)
}

func nonNilArray(a StringArray) StringArray {
	if a == nil {
		return StringArray{}
	}
	return a
}

func (s *AttendeeDirectoryStore) execOne(ctx context.Context, query string, args ...any) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *AttendeeDirectoryStore) SetDiscoverable(ctx context.Context, userID string, discoverable bool) error {
	return s.execOne(ctx,
		`UPDATE attendee_directory_profiles SET discoverable = $2 WHERE user_id = $1`, userID, discoverable)
}

func (s *AttendeeDirectoryStore) ConfirmStatus(ctx context.Context, userID string) error {
	return s.execOne(ctx,
		`UPDATE attendee_directory_profiles SET status_confirmed_at = NOW() WHERE user_id = $1`, userID)
}

// SetDiscord stores (or, with nil values, clears) the OAuth-linked Discord account.
func (s *AttendeeDirectoryStore) SetDiscord(ctx context.Context, userID string, discordUserID, discordUsername *string) error {
	return s.execOne(ctx, `
		UPDATE attendee_directory_profiles
		SET discord_user_id = $2, discord_username = $3
		WHERE user_id = $1`, userID, discordUserID, discordUsername)
}

func (s *AttendeeDirectoryStore) SetModeration(ctx context.Context, userID, adminID string, hidden bool, reason *string) error {
	if !hidden {
		return s.execOne(ctx, `
			UPDATE attendee_directory_profiles
			SET moderation_hidden_at = NULL, moderation_hidden_by = NULL, moderation_reason = NULL
			WHERE user_id = $1`, userID)
	}
	return s.execOne(ctx, `
		UPDATE attendee_directory_profiles
		SET moderation_hidden_at = COALESCE(moderation_hidden_at, NOW()),
		    moderation_hidden_by = $2, moderation_reason = $3
		WHERE user_id = $1`, userID, adminID, reason)
}

// directoryCardSelect needs $1 = viewer ID, $2 = check-in scan types,
// $3 = stale cutoff (nullable).
const directoryCardSelect = `
	SELECT p.user_id, p.display_name, p.pronouns, p.headshot_path, u.profile_picture_url,
	       p.skills, p.interest_tags, p.roles_looking_for, p.icebreaker_prompt,
	       p.icebreaker_answer, p.want_to_build, p.intent, p.spots_needed, p.status_confirmed_at,
	       EXISTS (SELECT 1 FROM scans s WHERE s.user_id = p.user_id AND s.scan_type = ANY($2::text[])) AS checked_in,
	       ($3::timestamptz IS NOT NULL AND p.status_confirmed_at < $3::timestamptz) AS stale,
	       EXISTS (SELECT 1 FROM pokes k WHERE k.poker_id = $1 AND k.pokee_id = p.user_id) AS poked_by_me,
	       EXISTS (SELECT 1 FROM pokes k WHERE k.poker_id = p.user_id AND k.pokee_id = $1) AS poked_me,
	       EXISTS (SELECT 1 FROM directory_contacts c WHERE c.owner_id = $1 AND c.contact_id = p.user_id) AS is_contact,
	       EXISTS (SELECT 1 FROM directory_hidden_profiles h WHERE h.owner_id = $1 AND h.hidden_id = p.user_id) AS is_hidden,
	       p.discord_user_id,
	       COALESCE(NULLIF(p.discord_username, ''), NULLIF(BTRIM(a.rsvp_responses->>'discord_username'), '')) AS discord_username`

const directoryCardFrom = `
	FROM attendee_directory_profiles p
	JOIN users u ON u.id = p.user_id
	LEFT JOIN applications a ON a.user_id = p.user_id`

func scanDirectoryCard(row interface{ Scan(...any) error }, extra ...any) (*DirectoryCard, error) {
	var c DirectoryCard
	dest := []any{
		&c.UserID, &c.DisplayName, &c.Pronouns, &c.HeadshotPath, &c.ProfilePictureURL,
		&c.Skills, &c.InterestTags, &c.RolesLookingFor, &c.IcebreakerPrompt,
		&c.IcebreakerAnswer, &c.WantToBuild, &c.Intent, &c.SpotsNeeded, &c.StatusConfirmedAt,
		&c.CheckedIn, &c.Stale, &c.PokedByMe, &c.PokedMe, &c.IsContact, &c.IsHidden,
		&c.DiscordUserID, &c.DiscordUsername,
	}
	if err := row.Scan(append(dest, extra...)...); err != nil {
		return nil, err
	}
	c.Matched = c.PokedByMe && c.PokedMe
	if !c.Matched {
		c.DiscordUserID = nil
		c.DiscordUsername = nil
	}
	if c.Skills == nil {
		c.Skills = StringArray{}
	}
	if c.InterestTags == nil {
		c.InterestTags = StringArray{}
	}
	if c.RolesLookingFor == nil {
		c.RolesLookingFor = StringArray{}
	}
	return &c, nil
}

func viewerArgs(v DirectoryViewer) []any {
	var cutoff any
	if v.StaleCutoff != nil {
		cutoff = *v.StaleCutoff
	}
	types := StringArray(v.CheckInTypes)
	if types == nil {
		types = StringArray{}
	}
	return []any{v.UserID, types, cutoff}
}

// List returns the browse feed: other eligible, discoverable, unmoderated
// cards. Fresh cards come before stale ones, newest status first.
func (s *AttendeeDirectoryStore) List(ctx context.Context, viewer DirectoryViewer, filters DirectoryFilters, cursor *DirectoryCursor, limit int) (*DirectoryListResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	args := viewerArgs(viewer)
	where := []string{
		"p.user_id <> $1",
		"p.discoverable",
		"p.moderation_hidden_at IS NULL",
		directoryEligibleCondition,
	}
	if filters.Hidden {
		where = append(where, "EXISTS (SELECT 1 FROM directory_hidden_profiles h WHERE h.owner_id = $1 AND h.hidden_id = p.user_id)")
	} else {
		where = append(where, "NOT EXISTS (SELECT 1 FROM directory_hidden_profiles h WHERE h.owner_id = $1 AND h.hidden_id = p.user_id)")
	}
	if len(filters.Intents) > 0 {
		intents := make(StringArray, len(filters.Intents))
		for i, in := range filters.Intents {
			intents[i] = string(in)
		}
		args = append(args, intents)
		where = append(where, fmt.Sprintf("p.intent::text = ANY($%d::text[])", len(args)))
	}
	if len(filters.InterestTags) > 0 {
		args = append(args, StringArray(filters.InterestTags))
		where = append(where, fmt.Sprintf("p.interest_tags && $%d::text[]", len(args)))
	}
	if q := strings.TrimSpace(filters.Search); q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(p.display_name ILIKE $%d OR EXISTS (SELECT 1 FROM unnest(p.skills) sk WHERE sk ILIKE $%d))", n, n))
	}
	if filters.CheckedIn {
		where = append(where, "EXISTS (SELECT 1 FROM scans s WHERE s.user_id = p.user_id AND s.scan_type = ANY($2::text[]))")
	}

	staleExpr := "($3::timestamptz IS NOT NULL AND p.status_confirmed_at < $3::timestamptz)"
	if cursor != nil {
		args = append(args, cursor.Stale, cursor.StatusConfirmedAt, cursor.UserID)
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(%[1]s::int > $%[2]d::boolean::int OR (%[1]s = $%[2]d AND (p.status_confirmed_at < $%[3]d OR (p.status_confirmed_at = $%[3]d AND p.user_id > $%[4]d))))",
			staleExpr, n-2, n-1, n))
	}

	args = append(args, limit+1)
	query := directoryCardSelect + directoryCardFrom + `
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ` + staleExpr + ` ASC, p.status_confirmed_at DESC, p.user_id ASC
		LIMIT $` + fmt.Sprint(len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := []DirectoryCard{}
	for rows.Next() {
		c, err := scanDirectoryCard(rows)
		if err != nil {
			return nil, err
		}
		cards = append(cards, *c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := &DirectoryListResult{Cards: cards}
	if len(cards) > limit {
		result.Cards = cards[:limit]
		last := result.Cards[limit-1]
		next := EncodeDirectoryCursor(DirectoryCursor{Stale: last.Stale, StatusConfirmedAt: last.StatusConfirmedAt, UserID: last.UserID})
		result.NextCursor = &next
	}
	return result, nil
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (s *AttendeeDirectoryStore) listRelated(ctx context.Context, viewer DirectoryViewer, join, orderBy string) ([]DirectoryCard, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	// Contacts and pokes outlive the target turning discoverable off: the
	// relationship already exists, so only moderation removes the card here.
	query := directoryCardSelect + `, rel.created_at` + directoryCardFrom + join + `
		WHERE p.moderation_hidden_at IS NULL
		ORDER BY ` + orderBy

	rows, err := s.db.QueryContext(ctx, query, viewerArgs(viewer)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := []DirectoryCard{}
	for rows.Next() {
		var relatedAt time.Time
		c, err := scanDirectoryCard(rows, &relatedAt)
		if err != nil {
			return nil, err
		}
		c.RelatedAt = &relatedAt
		cards = append(cards, *c)
	}
	return cards, rows.Err()
}

func (s *AttendeeDirectoryStore) ListContacts(ctx context.Context, viewer DirectoryViewer) ([]DirectoryCard, error) {
	return s.listRelated(ctx, viewer,
		` JOIN directory_contacts rel ON rel.contact_id = p.user_id AND rel.owner_id = $1`,
		`rel.created_at DESC, p.user_id`)
}

func (s *AttendeeDirectoryStore) ListPokedMe(ctx context.Context, viewer DirectoryViewer) ([]DirectoryCard, error) {
	return s.listRelated(ctx, viewer,
		` JOIN pokes rel ON rel.poker_id = p.user_id AND rel.pokee_id = $1`,
		`rel.created_at DESC, p.user_id`)
}

// GetCard returns one card from the viewer's perspective, regardless of
// visibility; callers decide whether the viewer may see it.
func (s *AttendeeDirectoryStore) GetCard(ctx context.Context, viewer DirectoryViewer, targetID string) (*DirectoryCard, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	args := append(viewerArgs(viewer), targetID)
	row := s.db.QueryRowContext(ctx, directoryCardSelect+directoryCardFrom+` WHERE p.user_id = $4`, args...)
	c, err := scanDirectoryCard(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return c, err
}

// GetTarget reports what a viewer needs to know before poking or saving a card.
func (s *AttendeeDirectoryStore) GetTarget(ctx context.Context, viewerID, targetID string) (*DirectoryTarget, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var t DirectoryTarget
	err := s.db.QueryRowContext(ctx, `
		SELECT p.discoverable,
		       p.moderation_hidden_at IS NOT NULL,
		       EXISTS (SELECT 1 FROM applications a WHERE a.user_id = p.user_id AND `+directoryEligibleCondition+`),
		       EXISTS (SELECT 1 FROM pokes k WHERE k.poker_id = p.user_id AND k.pokee_id = $1)
		FROM attendee_directory_profiles p
		WHERE p.user_id = $2`, viewerID, targetID,
	).Scan(&t.Discoverable, &t.ModerationHidden, &t.Eligible, &t.PokedViewer)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Poke records a one-way poke and saves the pokee to the poker's contacts.
// Poking twice is a no-op. Matched is true once the pokee has poked back.
func (s *AttendeeDirectoryStore) Poke(ctx context.Context, pokerID, pokeeID string) (*PokeResult, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		`INSERT INTO pokes (poker_id, pokee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, pokerID, pokeeID)
	if err != nil {
		return nil, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO directory_contacts (owner_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		pokerID, pokeeID); err != nil {
		return nil, err
	}

	var matched bool
	if err := tx.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM pokes WHERE poker_id = $1 AND pokee_id = $2)`, pokeeID, pokerID,
	).Scan(&matched); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &PokeResult{Created: n > 0, Matched: matched}, nil
}

func (s *AttendeeDirectoryStore) exec(ctx context.Context, query string, args ...any) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	_, err := s.db.ExecContext(ctx, query, args...)
	return err
}

func (s *AttendeeDirectoryStore) AddContact(ctx context.Context, ownerID, contactID string) error {
	return s.exec(ctx,
		`INSERT INTO directory_contacts (owner_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, ownerID, contactID)
}

func (s *AttendeeDirectoryStore) RemoveContact(ctx context.Context, ownerID, contactID string) error {
	return s.exec(ctx,
		`DELETE FROM directory_contacts WHERE owner_id = $1 AND contact_id = $2`, ownerID, contactID)
}

func (s *AttendeeDirectoryStore) Hide(ctx context.Context, ownerID, hiddenID string) error {
	return s.exec(ctx,
		`INSERT INTO directory_hidden_profiles (owner_id, hidden_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, ownerID, hiddenID)
}

func (s *AttendeeDirectoryStore) Unhide(ctx context.Context, ownerID, hiddenID string) error {
	return s.exec(ctx,
		`DELETE FROM directory_hidden_profiles WHERE owner_id = $1 AND hidden_id = $2`, ownerID, hiddenID)
}

// AdminList returns cards for moderation, optionally filtered by name or email.
func (s *AttendeeDirectoryStore) AdminList(ctx context.Context, search string, limit int) ([]DirectoryAdminProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT p.user_id, u.email, p.display_name, p.discoverable, p.moderation_hidden_at,
		       p.moderation_reason, p.icebreaker_answer, p.want_to_build, p.created_at,
		       p.moderation_hidden_by
		FROM attendee_directory_profiles p
		JOIN users u ON u.id = p.user_id`
	args := []any{}
	if q := strings.TrimSpace(search); q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		query += ` WHERE p.display_name ILIKE $1 OR u.email ILIKE $1`
	}
	args = append(args, limit)
	query += fmt.Sprintf(` ORDER BY p.created_at DESC LIMIT $%d`, len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []DirectoryAdminProfile{}
	for rows.Next() {
		var p DirectoryAdminProfile
		if err := rows.Scan(&p.UserID, &p.Email, &p.DisplayName, &p.Discoverable, &p.ModerationHiddenAt,
			&p.ModerationReason, &p.IcebreakerAnswer, &p.WantToBuild, &p.CreatedAt, &p.ModerationHiddenBy); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// collectDirectoryHeadshotPaths reads every uploaded headshot so the objects
// can be removed from storage along with the cards that referenced them.
func collectDirectoryHeadshotPaths(ctx context.Context, q interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, where string, args ...any) ([]string, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT headshot_path FROM attendee_directory_profiles WHERE headshot_path IS NOT NULL`+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}
