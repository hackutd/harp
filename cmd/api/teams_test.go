package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func teamsRouter(app *application) chi.Router {
	r := chi.NewRouter()
	r.Put("/{teamID}", app.updateTeamHandler)
	r.Delete("/{teamID}", app.deleteTeamHandler)
	return r
}

func newTestTeam() *store.Team {
	return &store.Team{
		ID:        "team-1",
		Name:      "Test Team",
		Code:      "ABC123",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func newTestTeamMembers() []store.TeamMember {
	return []store.TeamMember{
		{
			UserID:   "user-1",
			Email:    "hacker@test.com",
			JoinedAt: time.Now(),
		},
	}
}

func TestCreateTeam(t *testing.T) {
	t.Run("returns 201 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		mockTeams.On("Create", mock.AnythingOfType("*store.Team"), "user-1").Return(nil).Once()
		mockTeams.On("GetMembers", mock.AnythingOfType("string")).Return(newTestTeamMembers(), nil).Once()

		body := `{"name":"My Team"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTeamHandler))
		checkResponseCode(t, http.StatusCreated, rr.Code)

		var resp struct {
			Data TeamResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "My Team", resp.Data.Team.Name)
		assert.Len(t, resp.Data.Team.Members, 1)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 409 when user already in team", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		mockTeams.On("Create", mock.AnythingOfType("*store.Team"), "user-1").Return(store.ErrAlreadyInTeam).Once()

		body := `{"name":"My Team"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTeamHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 400 with missing name", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.createTeamHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetTeam(t *testing.T) {
	t.Run("returns 200 with team and members", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		team := newTestTeam()
		members := newTestTeamMembers()

		mockTeams.On("GetByUserID", "user-1").Return(team, nil).Once()
		mockTeams.On("GetMembers", "team-1").Return(members, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTeamHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data TeamResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "Test Team", resp.Data.Team.Name)
		assert.Equal(t, "ABC123", resp.Data.Team.Code)
		assert.Len(t, resp.Data.Team.Members, 1)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 404 when not in team", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		mockTeams.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTeamHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTeams.AssertExpectations(t)
	})
}

func TestJoinTeam(t *testing.T) {
	t.Run("returns 200 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		team := newTestTeam()
		members := append(newTestTeamMembers(), store.TeamMember{
			UserID:   "user-2",
			Email:    "hacker2@test.com",
			JoinedAt: time.Now(),
		})

		mockTeams.On("GetByCode", "ABC123").Return(team, nil).Once()
		mockTeams.On("AddMember", "team-1", "user-1").Return(nil).Once()
		mockTeams.On("GetMembers", "team-1").Return(members, nil).Once()

		body := `{"code":"abc123"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.joinTeamHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data TeamResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Len(t, resp.Data.Team.Members, 2)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 404 with invalid code", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		mockTeams.On("GetByCode", "XXXXXX").Return(nil, store.ErrNotFound).Once()

		body := `{"code":"XXXXXX"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.joinTeamHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 409 when team is full", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		team := newTestTeam()
		mockTeams.On("GetByCode", "ABC123").Return(team, nil).Once()
		mockTeams.On("AddMember", "team-1", "user-1").Return(store.ErrTeamFull).Once()

		body := `{"code":"ABC123"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.joinTeamHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 409 when already in a team", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		team := newTestTeam()
		mockTeams.On("GetByCode", "ABC123").Return(team, nil).Once()
		mockTeams.On("AddMember", "team-1", "user-1").Return(store.ErrAlreadyInTeam).Once()

		body := `{"code":"ABC123"}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.joinTeamHandler))
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 400 with missing code", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.joinTeamHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestLeaveTeam(t *testing.T) {
	t.Run("returns 204 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		team := newTestTeam()
		mockTeams.On("GetByUserID", "user-1").Return(team, nil).Once()
		mockTeams.On("RemoveMember", "team-1", "user-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.leaveTeamHandler))
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 404 when not in team", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)

		mockTeams.On("GetByUserID", "user-1").Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodDelete, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, http.HandlerFunc(app.leaveTeamHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockTeams.AssertExpectations(t)
	})
}

func TestUpdateTeam(t *testing.T) {
	t.Run("returns 200 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)
		r := teamsRouter(app)

		team := newTestTeam()
		members := newTestTeamMembers()

		mockTeams.On("GetByUserID", "user-1").Return(team, nil).Once()
		mockTeams.On("Update", mock.AnythingOfType("*store.Team")).Return(nil).Once()
		mockTeams.On("GetMembers", "team-1").Return(members, nil).Once()

		body := `{"name":"Updated Team"}`
		req, err := http.NewRequest(http.MethodPut, "/team-1", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data TeamResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, "Updated Team", resp.Data.Team.Name)
		assert.Len(t, resp.Data.Team.Members, 1)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 403 when not a member", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)
		r := teamsRouter(app)

		// User is in a different team
		otherTeam := &store.Team{
			ID:   "team-2",
			Name: "Other Team",
			Code: "XYZ789",
		}
		mockTeams.On("GetByUserID", "user-1").Return(otherTeam, nil).Once()

		body := `{"name":"Updated Team"}`
		req, err := http.NewRequest(http.MethodPut, "/team-1", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 400 with missing name", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)
		r := teamsRouter(app)

		team := newTestTeam()
		mockTeams.On("GetByUserID", "user-1").Return(team, nil).Once()

		body := `{}`
		req, err := http.NewRequest(http.MethodPut, "/team-1", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockTeams.AssertExpectations(t)
	})
}

func TestDeleteTeam(t *testing.T) {
	t.Run("returns 204 on success", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)
		r := teamsRouter(app)

		team := newTestTeam()
		mockTeams.On("GetByUserID", "user-1").Return(team, nil).Once()
		mockTeams.On("Delete", "team-1").Return(nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/team-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusNoContent, rr.Code)

		mockTeams.AssertExpectations(t)
	})

	t.Run("returns 403 when not a member", func(t *testing.T) {
		app := newTestApplication(t)
		mockTeams := app.store.Teams.(*store.MockTeamsStore)
		r := teamsRouter(app)

		otherTeam := &store.Team{
			ID:   "team-2",
			Name: "Other Team",
			Code: "XYZ789",
		}
		mockTeams.On("GetByUserID", "user-1").Return(otherTeam, nil).Once()

		req, err := http.NewRequest(http.MethodDelete, "/team-1", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, r)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockTeams.AssertExpectations(t)
	})
}
