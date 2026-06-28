package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetWalkIns(t *testing.T) {
	t.Run("returns queue depth and pending list", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)

		queue := []store.WalkIn{
			{ID: "wi-1", UserID: "user-1", Email: "a@test.com", Position: 1},
			{ID: "wi-2", UserID: "user-2", Email: "b@test.com", Position: 2},
			{ID: "wi-3", UserID: "user-3", Email: "c@test.com", Position: 3},
		}
		mockWalkIns.On("QueueDepth").Return(3, 5, nil).Once()
		mockWalkIns.On("List").Return(queue, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getWalkInsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data WalkInsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 3, body.Data.Pending)
		assert.Equal(t, 5, body.Data.Total)
		assert.Len(t, body.Data.Queue, 3)
		assert.Equal(t, 1, body.Data.Queue[0].Position)

		mockWalkIns.AssertExpectations(t)
	})

	t.Run("empty queue returns zero counts", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)

		mockWalkIns.On("QueueDepth").Return(0, 0, nil).Once()
		mockWalkIns.On("List").Return([]store.WalkIn{}, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getWalkInsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data WalkInsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 0, body.Data.Pending)
		assert.Empty(t, body.Data.Queue)

		mockWalkIns.AssertExpectations(t)
	})

	t.Run("store error returns 500", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)

		mockWalkIns.On("QueueDepth").Return(0, 0, errors.New("db error")).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getWalkInsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockWalkIns.AssertExpectations(t)
	})
}

func TestPromoteWalkIns(t *testing.T) {
	t.Run("promotes N users and fires acceptance emails", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		promoted := []store.User{
			{ID: "user-1", Email: "a@test.com"},
			{ID: "user-2", Email: "b@test.com"},
			{ID: "user-3", Email: "c@test.com"},
		}
		mockWalkIns.On("PromoteNext", 3, "superadmin-1").Return(promoted, nil).Once()
		mockMailer.On("SendWalkInAcceptedEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil).Maybe()

		body := `{"count":3}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.promoteWalkInsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data PromoteWalkInsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, 3, resp.Data.PromotedCount)
		assert.Len(t, resp.Data.Promoted, 3)

		mockWalkIns.AssertExpectations(t)
	})

	t.Run("count=0 returns 400", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"count":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.promoteWalkInsHandler))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("promotes only available when count exceeds pending", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)
		mockMailer := app.mailer.(*mailer.MockClient)

		promoted := []store.User{
			{ID: "user-1", Email: "a@test.com"},
		}
		mockWalkIns.On("PromoteNext", 5, "superadmin-1").Return(promoted, nil).Once()
		mockMailer.On("SendWalkInAcceptedEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil).Maybe()

		body := `{"count":5}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.promoteWalkInsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var resp struct {
			Data PromoteWalkInsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, 1, resp.Data.PromotedCount)

		mockWalkIns.AssertExpectations(t)
	})

	t.Run("store error returns 500", func(t *testing.T) {
		app := newTestApplication(t)
		mockWalkIns := app.store.WalkIns.(*store.MockWalkInsStore)

		mockWalkIns.On("PromoteNext", 3, "superadmin-1").Return(nil, errors.New("db error")).Once()

		body := `{"count":3}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.promoteWalkInsHandler))
		checkResponseCode(t, http.StatusInternalServerError, rr.Code)

		mockWalkIns.AssertExpectations(t)
	})
}
