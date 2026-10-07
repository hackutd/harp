package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/slug"
	"github.com/hackutd/harp/internal/store"
)

const (
	directoryPageSize        = 24
	directoryMaxPageSize     = 60
	directoryStaleAfter      = 72 * time.Hour
	directoryEventNearWindow = 7 * 24 * time.Hour
	directoryHeadshotFolder  = "directory-headshots"
	directoryMaxSkills       = 3
	directoryMaxInterestTags = 5
	directoryAdminListLimit  = 200
)

var directoryHeadshotContentTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

var directoryIntents = []store.DirectoryIntent{
	store.DirectoryIntentLookingForTeammates,
	store.DirectoryIntentPartialTeam,
	store.DirectoryIntentTeamSet,
	store.DirectoryIntentOpenToCollab,
	store.DirectoryIntentJustNetworking,
}

// directoryIcebreakerPrompts is the fixed set of icebreaker prompts.
var directoryIcebreakerPrompts = []string{
	"The best hack I've ever seen was...",
	"Ask me about...",
	"My hot take on tech is...",
	"After this hackathon I want to...",
	"The snack that fuels my code is...",
	"My go-to debugging move is...",
}

var (
	errDirectoryNotEligible = errors.New("the attendee directory is open to hackers with a confirmed RSVP")
	errDirectoryNoCard      = errors.New("create your directory card to browse who's attending")
	errDirectoryUnavailable = errors.New("this attendee isn't accepting pokes or contact adds")
	errDirectoryModerated   = errors.New("your directory card is under review")
)

// DirectoryOptions lists the fixed choices for card fields.
type DirectoryOptions struct {
	InterestTags      []string `json:"interest_tags"`
	Roles             []string `json:"roles"`
	Intents           []string `json:"intents"`
	IcebreakerPrompts []string `json:"icebreaker_prompts"`
	MaxSkills         int      `json:"max_skills"`
	MaxInterestTags   int      `json:"max_interest_tags"`
}

type DirectoryProfileResponse struct {
	store.DirectoryProfile
	HeadshotURL *string `json:"headshot_url"`
}

type DirectoryMeResponse struct {
	Eligible            bool                      `json:"eligible"`
	Profile             *DirectoryProfileResponse `json:"profile"`
	StatusStale         bool                      `json:"status_stale"`
	EventNear           bool                      `json:"event_near"`
	RSVPDiscordUsername *string                   `json:"rsvp_discord_username"`
	DiscordOAuthEnabled bool                      `json:"discord_oauth_enabled"`
	Options             DirectoryOptions          `json:"options"`
}

type UpsertDirectoryProfilePayload struct {
	DisplayName      string                `json:"display_name" validate:"required,max=60"`
	Pronouns         *string               `json:"pronouns" validate:"omitempty,max=30"`
	HeadshotPath     *string               `json:"headshot_path"`
	Skills           []string              `json:"skills" validate:"max=3,dive,max=40"`
	InterestTags     []string              `json:"interest_tags" validate:"max=5,unique"`
	RolesLookingFor  []string              `json:"roles_looking_for" validate:"max=10,unique"`
	IcebreakerPrompt *string               `json:"icebreaker_prompt" validate:"omitempty,max=120"`
	IcebreakerAnswer *string               `json:"icebreaker_answer" validate:"omitempty,max=200"`
	WantToBuild      *string               `json:"want_to_build" validate:"omitempty,max=100"`
	Intent           store.DirectoryIntent `json:"intent" validate:"required,oneof=looking_for_teammates partial_team team_set open_to_collab just_networking"`
	SpotsNeeded      *int                  `json:"spots_needed" validate:"omitempty,min=1,max=5"`
	Discoverable     *bool                 `json:"discoverable"`
}

type UpdateDirectoryDiscoverablePayload struct {
	Discoverable *bool `json:"discoverable" validate:"required"`
}

type DirectoryHeadshotUploadURLPayload struct {
	ContentType string `json:"content_type" validate:"required,oneof=image/jpeg image/png image/webp"`
}

type DirectoryHeadshotUploadURLResponse struct {
	UploadURL    string `json:"upload_url"`
	HeadshotPath string `json:"headshot_path"`
}

type DirectoryListResponse struct {
	Cards      []store.DirectoryCard `json:"cards"`
	NextCursor *string               `json:"next_cursor"`
	EventNear  bool                  `json:"event_near"`
}

type DirectoryCardsResponse struct {
	Cards []store.DirectoryCard `json:"cards"`
}

type DirectoryPokeResponse struct {
	Matched bool                `json:"matched"`
	Card    store.DirectoryCard `json:"card"`
}

type DirectoryCardResponse struct {
	Card store.DirectoryCard `json:"card"`
}

type DirectoryModerationPayload struct {
	Hidden *bool   `json:"hidden" validate:"required"`
	Reason *string `json:"reason" validate:"omitempty,max=300"`
}

type DirectoryAdminListResponse struct {
	Profiles []store.DirectoryAdminProfile `json:"profiles"`
}

type DirectoryInterestTagsResponse struct {
	Tags []string `json:"tags"`
}

type UpdateDirectoryInterestTagsPayload struct {
	Tags []string `json:"tags" validate:"max=50,unique,dive,required,max=30"`
}

func directoryHeadshotStoragePrefix(hackathonName string) string {
	return fmt.Sprintf("%s%s/%s/", hackathonStorageRootPrefix, slug.Hackathon(hackathonName), directoryHeadshotFolder)
}

// directoryHeadshotObjectOwner returns the user a headshot object belongs to,
// and whether the path has the shape this API issues:
// hackathons/{slug}/directory-headshots/{userID}/{random}.{ext}.
func directoryHeadshotObjectOwner(objectPath string) (string, bool) {
	parts := strings.Split(objectPath, "/")
	if len(parts) != 5 ||
		parts[0] != strings.TrimSuffix(hackathonStorageRootPrefix, "/") ||
		parts[1] == "" ||
		parts[2] != directoryHeadshotFolder ||
		parts[3] == "" {
		return "", false
	}
	name, ext, ok := strings.Cut(parts[4], ".")
	if !ok || len(name) != randomResumeObjectIDBytes*2 || !isLowerHex(name) {
		return "", false
	}
	known := false
	for _, e := range directoryHeadshotContentTypes {
		if e == ext {
			known = true
		}
	}
	if !known {
		return "", false
	}
	return parts[3], true
}

func isLowerHex(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

// directoryTiming reports whether the event is close, and if so the cutoff
// before which a confirmed status counts as stale.
func (app *application) directoryTiming(ctx context.Context, now time.Time) (bool, *time.Time, error) {
	dateRange, err := app.store.Settings.GetHackathonDateRange(ctx)
	if err != nil {
		return false, nil, err
	}
	if !directoryEventNear(dateRange, now) {
		return false, nil, nil
	}
	cutoff := now.Add(-directoryStaleAfter)
	return true, &cutoff, nil
}

// directoryEventNear is true from a week before the event starts until the
// day after it ends.
func directoryEventNear(dateRange store.HackathonDateRange, now time.Time) bool {
	if dateRange.StartDate == nil {
		return false
	}
	start, err := time.Parse(time.DateOnly, *dateRange.StartDate)
	if err != nil {
		return false
	}
	end := start
	if dateRange.EndDate != nil {
		if parsed, err := time.Parse(time.DateOnly, *dateRange.EndDate); err == nil {
			end = parsed
		}
	}
	return !now.Before(start.Add(-directoryEventNearWindow)) && now.Before(end.Add(48*time.Hour))
}

func (app *application) directoryCheckInTypes(ctx context.Context) ([]string, error) {
	scanTypes, err := app.store.Settings.GetScanTypes(ctx)
	if err != nil {
		return nil, err
	}
	types := []string{}
	for _, st := range scanTypes {
		if st.Category == store.ScanCategoryCheckIn {
			types = append(types, st.Name)
		}
	}
	return types, nil
}

func (app *application) directoryViewer(ctx context.Context, userID string) (store.DirectoryViewer, bool, error) {
	checkInTypes, err := app.directoryCheckInTypes(ctx)
	if err != nil {
		return store.DirectoryViewer{}, false, err
	}
	near, cutoff, err := app.directoryTiming(ctx, time.Now())
	if err != nil {
		return store.DirectoryViewer{}, false, err
	}
	return store.DirectoryViewer{UserID: userID, CheckInTypes: checkInTypes, StaleCutoff: cutoff}, near, nil
}

func (app *application) directoryForbidden(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Warnw("directory forbidden", "error", err.Error())
	writeJSONError(w, http.StatusForbidden, err.Error())
}

// requireDirectoryAccess admits hackers who are still RSVP-confirmed and have
// a card. Discoverability does not matter: a hidden card keeps full access.
func (app *application) requireDirectoryAccess(w http.ResponseWriter, r *http.Request) (*store.User, *store.DirectoryProfile, bool) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return nil, nil, false
	}

	eligible, err := app.store.AttendeeDirectory.IsEligible(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return nil, nil, false
	}
	if !eligible {
		app.directoryForbidden(w, r, errDirectoryNotEligible)
		return nil, nil, false
	}

	profile, err := app.store.AttendeeDirectory.GetProfile(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.directoryForbidden(w, r, errDirectoryNoCard)
			return nil, nil, false
		}
		app.internalServerError(w, r, err)
		return nil, nil, false
	}
	return user, profile, true
}

// headshotURL signs the uploaded headshot, falling back to the account's
// profile picture (e.g. from Google sign-in).
func (app *application) headshotURL(ctx context.Context, headshotPath, profilePictureURL *string) *string {
	if headshotPath != nil && *headshotPath != "" && app.gcsClient != nil {
		url, err := app.gcsClient.GenerateDownloadURL(ctx, *headshotPath)
		if err == nil {
			return &url
		}
		app.logger.Warnw("failed to sign directory headshot", "error", err)
	}
	if profilePictureURL != nil && *profilePictureURL != "" {
		return profilePictureURL
	}
	return nil
}

func (app *application) withHeadshots(ctx context.Context, cards []store.DirectoryCard) []store.DirectoryCard {
	for i := range cards {
		cards[i].HeadshotURL = app.headshotURL(ctx, cards[i].HeadshotPath, cards[i].ProfilePictureURL)
	}
	return cards
}

func (app *application) directoryOptions(ctx context.Context) (DirectoryOptions, error) {
	tags, err := app.store.Settings.GetDirectoryInterestTags(ctx)
	if err != nil {
		return DirectoryOptions{}, err
	}
	intents := make([]string, len(directoryIntents))
	for i, in := range directoryIntents {
		intents[i] = string(in)
	}
	return DirectoryOptions{
		InterestTags:      tags,
		Roles:             store.DirectoryRoles,
		Intents:           intents,
		IcebreakerPrompts: directoryIcebreakerPrompts,
		MaxSkills:         directoryMaxSkills,
		MaxInterestTags:   directoryMaxInterestTags,
	}, nil
}

func (app *application) buildDirectoryMe(ctx context.Context, user *store.User) (*DirectoryMeResponse, error) {
	eligible, err := app.store.AttendeeDirectory.IsEligible(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	options, err := app.directoryOptions(ctx)
	if err != nil {
		return nil, err
	}
	near, cutoff, err := app.directoryTiming(ctx, time.Now())
	if err != nil {
		return nil, err
	}

	resp := &DirectoryMeResponse{
		Eligible:            eligible,
		EventNear:           near,
		DiscordOAuthEnabled: app.discordOAuthEnabled(),
		Options:             options,
	}

	profile, err := app.store.AttendeeDirectory.GetProfile(ctx, user.ID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return nil, err
	}
	if profile != nil {
		resp.Profile = &DirectoryProfileResponse{
			DirectoryProfile: *profile,
			HeadshotURL:      app.headshotURL(ctx, profile.HeadshotPath, user.ProfilePictureURL),
		}
		resp.StatusStale = cutoff != nil && profile.StatusConfirmedAt.Before(*cutoff)
	}

	if application, err := app.store.Application.GetByUserID(ctx, user.ID); err == nil {
		var rsvp struct {
			DiscordUsername string `json:"discord_username"`
		}
		if len(application.RSVPResponses) > 0 && json.Unmarshal(application.RSVPResponses, &rsvp) == nil {
			if trimmed := strings.TrimSpace(rsvp.DiscordUsername); trimmed != "" {
				resp.RSVPDiscordUsername = &trimmed
			}
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		return nil, err
	}

	return resp, nil
}

// getMyDirectoryProfileHandler returns the caller's directory card and whether they can have one.
//
//	@Summary		Get my directory card
//	@Description	Returns the caller's attendee directory card (null if none), eligibility, stale-status state, and the fixed field options.
//	@Tags			hackers/directory
//	@Produce		json
//	@Success		200	{object}	DirectoryMeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me [get]
func (app *application) getMyDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	resp, err := app.buildDirectoryMe(r.Context(), user)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}

func trimOptional(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

// normalizeDirectoryPayload trims input and checks it against the fixed option lists.
func normalizeDirectoryPayload(req *UpsertDirectoryProfilePayload, interestTags []string) error {
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	req.Pronouns = trimOptional(req.Pronouns)
	req.IcebreakerPrompt = trimOptional(req.IcebreakerPrompt)
	req.IcebreakerAnswer = trimOptional(req.IcebreakerAnswer)
	req.WantToBuild = trimOptional(req.WantToBuild)
	req.HeadshotPath = trimOptional(req.HeadshotPath)

	skills := make([]string, 0, len(req.Skills))
	for _, s := range req.Skills {
		if t := strings.TrimSpace(s); t != "" && !slices.Contains(skills, t) {
			skills = append(skills, t)
		}
	}
	req.Skills = skills

	if req.DisplayName == "" {
		return errors.New("display_name is required")
	}
	for _, tag := range req.InterestTags {
		if !slices.Contains(interestTags, tag) {
			return fmt.Errorf("unknown interest tag: %s", tag)
		}
	}
	for _, role := range req.RolesLookingFor {
		if !slices.Contains(store.DirectoryRoles, role) {
			return fmt.Errorf("unknown role: %s", role)
		}
	}
	if req.IcebreakerPrompt != nil && !slices.Contains(directoryIcebreakerPrompts, *req.IcebreakerPrompt) {
		return errors.New("unknown icebreaker prompt")
	}
	if req.IcebreakerAnswer != nil && req.IcebreakerPrompt == nil {
		return errors.New("icebreaker_answer needs an icebreaker_prompt")
	}
	if req.IcebreakerAnswer == nil {
		req.IcebreakerPrompt = nil
	}
	if req.Intent == store.DirectoryIntentPartialTeam {
		if req.SpotsNeeded == nil {
			return errors.New("spots_needed is required for partial_team")
		}
	} else {
		req.SpotsNeeded = nil
	}
	return nil
}

// upsertMyDirectoryProfileHandler creates or replaces the caller's directory card.
//
//	@Summary		Create or update my directory card
//	@Description	Creates or replaces the caller's attendee directory card. Requires a confirmed RSVP. Saving re-confirms the status. discoverable only applies when creating; use PATCH /directory/me/discoverable afterwards.
//	@Tags			hackers/directory
//	@Accept			json
//	@Produce		json
//	@Param			profile	body		UpsertDirectoryProfilePayload	true	"Directory card"
//	@Success		200		{object}	DirectoryMeResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me [put]
func (app *application) upsertMyDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req UpsertDirectoryProfilePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	eligible, err := app.store.AttendeeDirectory.IsEligible(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if !eligible {
		app.directoryForbidden(w, r, errDirectoryNotEligible)
		return
	}

	interestTags, err := app.store.Settings.GetDirectoryInterestTags(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := normalizeDirectoryPayload(&req, interestTags); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	existing, err := app.store.AttendeeDirectory.GetProfile(r.Context(), user.ID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		app.internalServerError(w, r, err)
		return
	}

	if req.HeadshotPath != nil {
		unchanged := existing != nil && existing.HeadshotPath != nil && *existing.HeadshotPath == *req.HeadshotPath
		if owner, ok := directoryHeadshotObjectOwner(*req.HeadshotPath); !unchanged && (!ok || owner != user.ID) {
			app.badRequestResponse(w, r, errors.New("invalid headshot_path"))
			return
		}
	}

	discoverable := true
	if req.Discoverable != nil {
		discoverable = *req.Discoverable
	}

	_, err = app.store.AttendeeDirectory.UpsertProfile(r.Context(), &store.DirectoryProfile{
		UserID:           user.ID,
		DisplayName:      req.DisplayName,
		Pronouns:         req.Pronouns,
		HeadshotPath:     req.HeadshotPath,
		Skills:           req.Skills,
		InterestTags:     req.InterestTags,
		RolesLookingFor:  req.RolesLookingFor,
		IcebreakerPrompt: req.IcebreakerPrompt,
		IcebreakerAnswer: req.IcebreakerAnswer,
		WantToBuild:      req.WantToBuild,
		Intent:           req.Intent,
		SpotsNeeded:      req.SpotsNeeded,
		Discoverable:     discoverable,
	})
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if existing != nil && existing.HeadshotPath != nil &&
		(req.HeadshotPath == nil || *req.HeadshotPath != *existing.HeadshotPath) {
		app.deleteDirectoryHeadshot(user.ID, *existing.HeadshotPath)
	}

	app.respondDirectoryMe(w, r, user)
}

func (app *application) respondDirectoryMe(w http.ResponseWriter, r *http.Request, user *store.User) {
	resp, err := app.buildDirectoryMe(r.Context(), user)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := app.jsonResponse(w, http.StatusOK, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteDirectoryHeadshot removes a replaced headshot on a best-effort basis.
func (app *application) deleteDirectoryHeadshot(userID, objectPath string) {
	if app.gcsClient == nil {
		return
	}
	app.backgroundJobs.Add(1)
	go func() {
		defer app.backgroundJobs.Done()
		ctx, cancel := context.WithTimeout(context.Background(), userUploadDeleteTimeout)
		defer cancel()
		if err := app.gcsClient.DeleteObject(ctx, objectPath); err != nil {
			app.logger.Warnw("failed to delete replaced directory headshot", "user_id", userID, "path", objectPath, "error", err)
		}
	}()
}

// updateMyDirectoryDiscoverableHandler toggles whether the caller's card shows up.
//
//	@Summary		Set my directory discoverability
//	@Description	Hides or shows the caller's card. Hidden cards are absent from all directory results and reject new pokes and contact adds, but the owner keeps full access and existing matches and contacts are untouched.
//	@Tags			hackers/directory
//	@Accept			json
//	@Produce		json
//	@Param			discoverable	body		UpdateDirectoryDiscoverablePayload	true	"Discoverability"
//	@Success		200				{object}	DirectoryMeResponse
//	@Failure		400				{object}	object{error=string}
//	@Failure		401				{object}	object{error=string}
//	@Failure		404				{object}	object{error=string}
//	@Failure		500				{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/discoverable [patch]
func (app *application) updateMyDirectoryDiscoverableHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req UpdateDirectoryDiscoverablePayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := app.store.AttendeeDirectory.SetDiscoverable(r.Context(), user.ID, *req.Discoverable); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.respondDirectoryMe(w, r, user)
}

// confirmMyDirectoryStatusHandler re-confirms the caller's intent/status is current.
//
//	@Summary		Re-confirm my directory status
//	@Description	Marks the caller's intent/status as still accurate, clearing the stale nudge and the stale demotion in browse results.
//	@Tags			hackers/directory
//	@Produce		json
//	@Success		200	{object}	DirectoryMeResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/confirm-status [post]
func (app *application) confirmMyDirectoryStatusHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	if err := app.store.AttendeeDirectory.ConfirmStatus(r.Context(), user.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.respondDirectoryMe(w, r, user)
}

// generateDirectoryHeadshotUploadURLHandler returns a signed upload URL for a headshot.
//
//	@Summary		Get directory headshot upload URL
//	@Description	Generates a signed GCS upload URL for a directory card headshot. Pass the returned headshot_path when saving the card.
//	@Tags			hackers/directory
//	@Accept			json
//	@Produce		json
//	@Param			upload	body		DirectoryHeadshotUploadURLPayload	true	"Content type"
//	@Success		200		{object}	DirectoryHeadshotUploadURLResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Failure		503		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/me/headshot-upload-url [post]
func (app *application) generateDirectoryHeadshotUploadURLHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req DirectoryHeadshotUploadURLPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	eligible, err := app.store.AttendeeDirectory.IsEligible(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if !eligible {
		app.directoryForbidden(w, r, errDirectoryNotEligible)
		return
	}

	if app.gcsClient == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "headshot uploads are not configured")
		return
	}

	randomID, err := randomHex(randomResumeObjectIDBytes)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	hackathonName, err := app.store.Settings.GetHackathonName(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	objectPath := fmt.Sprintf("%s%s/%s.%s", directoryHeadshotStoragePrefix(hackathonName), user.ID, randomID, directoryHeadshotContentTypes[req.ContentType])
	uploadURL, err := app.gcsClient.GenerateImageUploadURL(r.Context(), objectPath, req.ContentType)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DirectoryHeadshotUploadURLResponse{
		UploadURL:    uploadURL,
		HeadshotPath: objectPath,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

func splitQueryList(raw string) []string {
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		if t := strings.TrimSpace(part); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// listDirectoryHandler is the "Who's Attending" browse feed.
//
//	@Summary		Browse the attendee directory
//	@Description	Lists other confirmed attendees' discoverable cards. Requires your own card. Stale statuses sort last close to the event.
//	@Tags			hackers/directory
//	@Produce		json
//	@Param			intent		query		string	false	"Comma-separated intents"
//	@Param			tags		query		string	false	"Comma-separated interest tags (any match)"
//	@Param			q			query		string	false	"Skill or name search"
//	@Param			checked_in	query		bool	false	"Only checked-in attendees"
//	@Param			hidden		query		bool	false	"List the cards you hid instead"
//	@Param			cursor		query		string	false	"Pagination cursor"
//	@Param			limit		query		int		false	"Page size (default 24, max 60)"
//	@Success		200			{object}	DirectoryListResponse
//	@Failure		400			{object}	object{error=string}
//	@Failure		401			{object}	object{error=string}
//	@Failure		403			{object}	object{error=string}
//	@Failure		500			{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/profiles [get]
func (app *application) listDirectoryHandler(w http.ResponseWriter, r *http.Request) {
	user, _, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}

	q := r.URL.Query()
	filters := store.DirectoryFilters{
		InterestTags: splitQueryList(q.Get("tags")),
		Search:       q.Get("q"),
		CheckedIn:    q.Get("checked_in") == "true",
		Hidden:       q.Get("hidden") == "true",
	}
	if len(filters.Search) > 100 {
		app.badRequestResponse(w, r, errors.New("q is too long"))
		return
	}
	for _, in := range splitQueryList(q.Get("intent")) {
		intent := store.DirectoryIntent(in)
		if !slices.Contains(directoryIntents, intent) {
			app.badRequestResponse(w, r, fmt.Errorf("unknown intent: %s", in))
			return
		}
		filters.Intents = append(filters.Intents, intent)
	}

	limit := directoryPageSize
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > directoryMaxPageSize {
			app.badRequestResponse(w, r, errors.New("invalid limit"))
			return
		}
		limit = n
	}

	var cursor *store.DirectoryCursor
	if raw := q.Get("cursor"); raw != "" {
		c, err := store.DecodeDirectoryCursor(raw)
		if err != nil {
			app.badRequestResponse(w, r, err)
			return
		}
		cursor = c
	}

	viewer, near, err := app.directoryViewer(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	result, err := app.store.AttendeeDirectory.List(r.Context(), viewer, filters, cursor, limit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if err := app.jsonResponse(w, http.StatusOK, DirectoryListResponse{
		Cards:      app.withHeadshots(r.Context(), result.Cards),
		NextCursor: result.NextCursor,
		EventNear:  near,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

func (app *application) respondDirectoryCards(w http.ResponseWriter, r *http.Request, list func(context.Context, store.DirectoryViewer) ([]store.DirectoryCard, error)) {
	user, _, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	viewer, _, err := app.directoryViewer(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	cards, err := list(r.Context(), viewer)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := app.jsonResponse(w, http.StatusOK, DirectoryCardsResponse{Cards: app.withHeadshots(r.Context(), cards)}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// listDirectoryContactsHandler lists the caller's saved contacts.
//
//	@Summary		List my directory contacts
//	@Description	Lists the cards the caller saved, newest first. Contacts stay listed when the other person turns discoverability off. Discord details are only included for matches.
//	@Tags			hackers/directory
//	@Produce		json
//	@Success		200	{object}	DirectoryCardsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/contacts [get]
func (app *application) listDirectoryContactsHandler(w http.ResponseWriter, r *http.Request) {
	app.respondDirectoryCards(w, r, app.store.AttendeeDirectory.ListContacts)
}

// listDirectoryPokesHandler lists who poked the caller.
//
//	@Summary		List who poked me
//	@Description	Lists attendees who poked the caller, newest first, with whether the caller already poked back (a match).
//	@Tags			hackers/directory
//	@Produce		json
//	@Success		200	{object}	DirectoryCardsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/pokes [get]
func (app *application) listDirectoryPokesHandler(w http.ResponseWriter, r *http.Request) {
	app.respondDirectoryCards(w, r, app.store.AttendeeDirectory.ListPokedMe)
}

// directoryTargetAllowed checks whether the viewer may start a new relationship
// (poke or contact add) with a target. Undiscoverable or ineligible targets
// are off limits unless they poked the viewer first, so they can still be
// poked back into a match.
func (app *application) directoryTargetAllowed(w http.ResponseWriter, r *http.Request, viewer *store.User, viewerProfile *store.DirectoryProfile, targetID string) bool {
	if targetID == viewer.ID {
		app.badRequestResponse(w, r, errors.New("you can't do that to your own card"))
		return false
	}
	if viewerProfile.ModerationHidden {
		app.directoryForbidden(w, r, errDirectoryModerated)
		return false
	}

	target, err := app.store.AttendeeDirectory.GetTarget(r.Context(), viewer.ID, targetID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return false
		}
		app.internalServerError(w, r, err)
		return false
	}
	if target.ModerationHidden {
		app.notFoundResponse(w, r, errors.New("directory card not found"))
		return false
	}
	if (!target.Discoverable || !target.Eligible) && !target.PokedViewer {
		app.directoryForbidden(w, r, errDirectoryUnavailable)
		return false
	}
	return true
}

func (app *application) respondDirectoryCard(w http.ResponseWriter, r *http.Request, userID, targetID string) {
	viewer, _, err := app.directoryViewer(r.Context(), userID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	card, err := app.store.AttendeeDirectory.GetCard(r.Context(), viewer, targetID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	card.HeadshotURL = app.headshotURL(r.Context(), card.HeadshotPath, card.ProfilePictureURL)
	if err := app.jsonResponse(w, http.StatusOK, DirectoryCardResponse{Card: *card}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// pokeDirectoryProfileHandler pokes another attendee and saves them as a contact.
//
//	@Summary		Poke an attendee
//	@Description	Sends a one-way poke and adds the target to the caller's contacts. A mutual poke is a match and reveals Discord details to both. The target gets a push notification. Rejected when the target is not discoverable, unless they poked the caller first.
//	@Tags			hackers/directory
//	@Produce		json
//	@Param			userID	path		string	true	"Target user ID"
//	@Success		200		{object}	DirectoryPokeResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/profiles/{userID}/poke [post]
func (app *application) pokeDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	user, profile, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userID")
	if !app.directoryTargetAllowed(w, r, user, profile, targetID) {
		return
	}

	result, err := app.store.AttendeeDirectory.Poke(r.Context(), user.ID, targetID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	viewer, _, err := app.directoryViewer(r.Context(), user.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	card, err := app.store.AttendeeDirectory.GetCard(r.Context(), viewer, targetID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	card.HeadshotURL = app.headshotURL(r.Context(), card.HeadshotPath, card.ProfilePictureURL)

	if result.Created {
		if result.Matched {
			app.sendPushToUsers([]string{targetID}, "It's a match!",
				fmt.Sprintf("%s poked you back. Say hi on Discord.", profile.DisplayName), "/app/directory/contacts")
		} else {
			app.sendPushToUsers([]string{targetID}, fmt.Sprintf("%s poked you", profile.DisplayName),
				"Poke back to match and swap Discord.", "/app/directory?tab=pokes")
		}
	}

	if err := app.jsonResponse(w, http.StatusOK, DirectoryPokeResponse{Matched: result.Matched, Card: *card}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// addDirectoryContactHandler privately bookmarks an attendee.
//
//	@Summary		Add a directory contact
//	@Description	Saves the target to the caller's private contact list. No notification is sent. Rejected when the target is not discoverable, unless they poked the caller first.
//	@Tags			hackers/directory
//	@Produce		json
//	@Param			userID	path		string	true	"Target user ID"
//	@Success		200		{object}	DirectoryCardResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/contacts/{userID} [put]
func (app *application) addDirectoryContactHandler(w http.ResponseWriter, r *http.Request) {
	user, profile, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userID")
	if !app.directoryTargetAllowed(w, r, user, profile, targetID) {
		return
	}
	if err := app.store.AttendeeDirectory.AddContact(r.Context(), user.ID, targetID); err != nil {
		app.internalServerError(w, r, err)
		return
	}
	app.respondDirectoryCard(w, r, user.ID, targetID)
}

// removeDirectoryContactHandler removes an attendee from the caller's contacts.
//
//	@Summary		Remove a directory contact
//	@Description	Removes the target from the caller's contact list. Pokes and matches are unaffected.
//	@Tags			hackers/directory
//	@Param			userID	path	string	true	"Target user ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/contacts/{userID} [delete]
func (app *application) removeDirectoryContactHandler(w http.ResponseWriter, r *http.Request) {
	user, _, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	if err := app.store.AttendeeDirectory.RemoveContact(r.Context(), user.ID, chi.URLParam(r, "userID")); err != nil {
		app.internalServerError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// hideDirectoryProfileHandler hides a card from the caller's browse feed.
//
//	@Summary		Hide a directory card
//	@Description	Hides the target from the caller's browse feed. Undo with DELETE; hidden cards are listed with GET /directory/profiles?hidden=true.
//	@Tags			hackers/directory
//	@Param			userID	path	string	true	"Target user ID"
//	@Success		204
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/hidden/{userID} [put]
func (app *application) hideDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	user, _, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userID")
	if targetID == user.ID {
		app.badRequestResponse(w, r, errors.New("you can't hide your own card"))
		return
	}
	if _, err := app.store.AttendeeDirectory.GetTarget(r.Context(), user.ID, targetID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	if err := app.store.AttendeeDirectory.Hide(r.Context(), user.ID, targetID); err != nil {
		app.internalServerError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// unhideDirectoryProfileHandler restores a hidden card to the caller's feed.
//
//	@Summary		Unhide a directory card
//	@Description	Restores a card the caller hid to their browse feed.
//	@Tags			hackers/directory
//	@Param			userID	path	string	true	"Target user ID"
//	@Success		204
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/directory/hidden/{userID} [delete]
func (app *application) unhideDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	user, _, ok := app.requireDirectoryAccess(w, r)
	if !ok {
		return
	}
	if err := app.store.AttendeeDirectory.Unhide(r.Context(), user.ID, chi.URLParam(r, "userID")); err != nil {
		app.internalServerError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listAdminDirectoryProfilesHandler lists directory cards for moderation.
//
//	@Summary		List directory cards (Admin)
//	@Description	Lists attendee directory cards for moderation, newest first, optionally filtered by display name or email.
//	@Tags			admin/directory
//	@Produce		json
//	@Param			search	query		string	false	"Name or email search"
//	@Success		200		{object}	DirectoryAdminListResponse
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/directory/profiles [get]
func (app *application) listAdminDirectoryProfilesHandler(w http.ResponseWriter, r *http.Request) {
	profiles, err := app.store.AttendeeDirectory.AdminList(r.Context(), r.URL.Query().Get("search"), directoryAdminListLimit)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := app.jsonResponse(w, http.StatusOK, DirectoryAdminListResponse{Profiles: profiles}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// moderateDirectoryProfileHandler hides or restores a directory card.
//
//	@Summary		Moderate a directory card (Admin)
//	@Description	Hides a card from every directory list and blocks its owner from sending new pokes or contact adds, or restores it. The owner cannot override a moderation hide.
//	@Tags			admin/directory
//	@Accept			json
//	@Param			userID		path	string						true	"Card owner user ID"
//	@Param			moderation	body	DirectoryModerationPayload	true	"Moderation"
//	@Success		204
//	@Failure		400	{object}	object{error=string}
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/admin/directory/profiles/{userID}/moderation [patch]
func (app *application) moderateDirectoryProfileHandler(w http.ResponseWriter, r *http.Request) {
	admin := getUserFromContext(r.Context())
	if admin == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}

	var req DirectoryModerationPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	targetID := chi.URLParam(r, "userID")
	if err := app.store.AttendeeDirectory.SetModeration(r.Context(), targetID, admin.ID, *req.Hidden, trimOptional(req.Reason)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, errors.New("directory card not found"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.requestLogger(r).Infow("directory card moderated", "target_user_id", targetID, "hidden", *req.Hidden)
	w.WriteHeader(http.StatusNoContent)
}

// getDirectoryInterestTagsHandler returns the directory interest tag list.
//
//	@Summary		Get directory interest tags (Super Admin)
//	@Description	Returns the fixed list of interest tags hackers can pick for their directory card.
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	DirectoryInterestTagsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/directory-interest-tags [get]
func (app *application) getDirectoryInterestTagsHandler(w http.ResponseWriter, r *http.Request) {
	tags, err := app.store.Settings.GetDirectoryInterestTags(r.Context())
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := app.jsonResponse(w, http.StatusOK, DirectoryInterestTagsResponse{Tags: tags}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// updateDirectoryInterestTagsHandler replaces the directory interest tag list.
//
//	@Summary		Update directory interest tags (Super Admin)
//	@Description	Replaces the interest tag list. Cards keep tags that were removed until they are next saved.
//	@Tags			superadmin/settings
//	@Accept			json
//	@Produce		json
//	@Param			tags	body		UpdateDirectoryInterestTagsPayload	true	"Tags"
//	@Success		200		{object}	DirectoryInterestTagsResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/directory-interest-tags [put]
func (app *application) updateDirectoryInterestTagsHandler(w http.ResponseWriter, r *http.Request) {
	var req UpdateDirectoryInterestTagsPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	for i := range req.Tags {
		req.Tags[i] = strings.TrimSpace(req.Tags[i])
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}
	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if err := app.store.Settings.SetDirectoryInterestTags(r.Context(), req.Tags); err != nil {
		app.internalServerError(w, r, err)
		return
	}
	if err := app.jsonResponse(w, http.StatusOK, DirectoryInterestTagsResponse{Tags: req.Tags}); err != nil {
		app.internalServerError(w, r, err)
	}
}
