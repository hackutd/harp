package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/hackutd/portal/internal/store"
)

type BatchSearchUsersPayload struct {
	Emails []string `json:"emails" validate:"required,min=1,max=50,dive,required,email"`
}

type BatchSearchFoundUser struct {
	ID        string         `json:"id"`
	Email     string         `json:"email"`
	Role      store.UserRole `json:"role"`
	CreatedAt time.Time      `json:"created_at"`
}

type BatchSearchUsersResponse struct {
	Found    []BatchSearchFoundUser `json:"found"`
	NotFound []string               `json:"not_found"`
}

// batchSearchUsersHandler searches users by email in batch.
//
//	@Summary		Batch search users by email (Super Admin)
//	@Description	Returns users found by emails and a list of emails not found
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		BatchSearchUsersPayload	true	"Emails to search"
//	@Success		200		{object}	BatchSearchUsersResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/users/search [post]
func (app *application) batchSearchUsersHandler(w http.ResponseWriter, r *http.Request) {
	var req BatchSearchUsersPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Deduplicate emails before querying while preserving first-seen order.
	seen := make(map[string]struct{}, len(req.Emails))
	dedupedEmails := make([]string, 0, len(req.Emails))
	for _, rawEmail := range req.Emails {
		email := strings.TrimSpace(rawEmail)
		key := strings.ToLower(email)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		dedupedEmails = append(dedupedEmails, email)
	}

	foundUsers, err := app.store.Users.GetByEmails(r.Context(), dedupedEmails)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	found := make([]BatchSearchFoundUser, 0, len(foundUsers))
	foundLookup := make(map[string]struct{}, len(foundUsers))
	for _, u := range foundUsers {
		found = append(found, BatchSearchFoundUser{
			ID:        u.ID,
			Email:     u.Email,
			Role:      u.Role,
			CreatedAt: u.CreatedAt,
		})
		foundLookup[strings.ToLower(u.Email)] = struct{}{}
	}

	notFound := make([]string, 0, len(dedupedEmails))
	for _, email := range dedupedEmails {
		if _, ok := foundLookup[strings.ToLower(email)]; !ok {
			notFound = append(notFound, email)
		}
	}

	resp := BatchSearchUsersResponse{
		Found:    found,
		NotFound: notFound,
	}

	if err := app.jsonResponse(w, http.StatusOK, resp); err != nil {
		app.internalServerError(w, r, err)
	}
}
