package main

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
)

type CreateTeamPayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type JoinTeamPayload struct {
	Code string `json:"code" validate:"required,len=6"`
}

type UpdateTeamPayload struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type TeamResponse struct {
	Team store.Team `json:"team"`
}

// createTeamHandler creates a new team and adds the creator as the first member
//
//	@Summary		Create team (Hacker)
//	@Description	Creates a new team with a generated join code. Fails if the user is already in a team.
//	@Tags			hackers/teams
//	@Accept			json
//	@Produce		json
//	@Param			team	body		CreateTeamPayload	true	"Team to create"
//	@Success		201		{object}	TeamResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams [post]
func (app *application) createTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	var payload CreateTeamPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	team := store.Team{Name: payload.Name}

	if err := app.store.Teams.Create(r.Context(), &team, user.ID); err != nil {
		if errors.Is(err, store.ErrAlreadyInTeam) {
			app.conflictResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	members, err := app.store.Teams.GetMembers(r.Context(), team.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	team.Members = members

	if err := app.jsonResponse(w, http.StatusCreated, TeamResponse{Team: team}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getTeamHandler returns the team for the currently authenticated user
//
//	@Summary		Get my team (Hacker)
//	@Description	Returns the team the current user belongs to, including all members.
//	@Tags			hackers/teams
//	@Produce		json
//	@Success		200	{object}	TeamResponse
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams/me [get]
func (app *application) getTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	team, err := app.store.Teams.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	members, err := app.store.Teams.GetMembers(r.Context(), team.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	team.Members = members

	if err := app.jsonResponse(w, http.StatusOK, TeamResponse{Team: *team}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// joinTeamHandler joins an existing team via invite code
//
//	@Summary		Join team (Hacker)
//	@Description	Joins a team using a 6-character invite code. Fails if the code is invalid, team is full, or user is already in a team.
//	@Tags			hackers/teams
//	@Accept			json
//	@Produce		json
//	@Param			join	body		JoinTeamPayload	true	"Team join code"
//	@Success		200		{object}	TeamResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		409		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams/join [post]
func (app *application) joinTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	var payload JoinTeamPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	code := strings.ToUpper(payload.Code)

	team, err := app.store.Teams.GetByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, fmt.Errorf("invalid team code"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.store.Teams.AddMember(r.Context(), team.ID, user.ID); err != nil {
		if errors.Is(err, store.ErrTeamFull) {
			app.conflictResponse(w, r, err)
			return
		}
		if errors.Is(err, store.ErrAlreadyInTeam) {
			app.conflictResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	members, err := app.store.Teams.GetMembers(r.Context(), team.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	team.Members = members

	if err := app.jsonResponse(w, http.StatusOK, TeamResponse{Team: *team}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// leaveTeamHandler removes the current user from their team
//
//	@Summary		Leave team (Hacker)
//	@Description	Removes the current user from their team. If the user is the last member, the team is deleted.
//	@Tags			hackers/teams
//	@Success		204
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams/leave [delete]
func (app *application) leaveTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())

	team, err := app.store.Teams.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, fmt.Errorf("not in a team"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	if err := app.store.Teams.RemoveMember(r.Context(), team.ID, user.ID); err != nil {
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// updateTeamHandler updates a team's name
//
//	@Summary		Update team (Hacker)
//	@Description	Updates the team name. Only members of the team can update it.
//	@Tags			hackers/teams
//	@Accept			json
//	@Produce		json
//	@Param			teamID	path		string				true	"Team ID"
//	@Param			team	body		UpdateTeamPayload	true	"Team update payload"
//	@Success		200		{object}	TeamResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		404		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams/{teamID} [put]
func (app *application) updateTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	teamID := chi.URLParam(r, "teamID")

	// Verify user is a member of this team
	userTeam, err := app.store.Teams.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.forbiddenResponse(w, r, fmt.Errorf("not a member of any team"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	if userTeam.ID != teamID {
		app.forbiddenResponse(w, r, fmt.Errorf("not a member of this team"))
		return
	}

	var payload UpdateTeamPayload
	if err := readJSON(w, r, &payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(payload); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	userTeam.Name = payload.Name

	if err := app.store.Teams.Update(r.Context(), userTeam); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	members, err := app.store.Teams.GetMembers(r.Context(), userTeam.ID)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}
	userTeam.Members = members

	if err := app.jsonResponse(w, http.StatusOK, TeamResponse{Team: *userTeam}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteTeamHandler deletes a team
//
//	@Summary		Delete team (Hacker)
//	@Description	Deletes a team. Only members of the team can delete it.
//	@Tags			hackers/teams
//	@Param			teamID	path	string	true	"Team ID"
//	@Success		204
//	@Failure		403	{object}	object{error=string}
//	@Failure		404	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/teams/{teamID} [delete]
func (app *application) deleteTeamHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	teamID := chi.URLParam(r, "teamID")

	// Verify user is a member of this team
	userTeam, err := app.store.Teams.GetByUserID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.forbiddenResponse(w, r, fmt.Errorf("not a member of any team"))
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	if userTeam.ID != teamID {
		app.forbiddenResponse(w, r, fmt.Errorf("not a member of this team"))
		return
	}

	if err := app.store.Teams.Delete(r.Context(), teamID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			app.notFoundResponse(w, r, err)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
