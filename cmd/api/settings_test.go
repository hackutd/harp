package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/portal/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetShortAnswerQuestions(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return questions", func(t *testing.T) {
		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why do you want to attend?", Required: true, DisplayOrder: 0},
			{ID: "q2", Question: "Tell us about a project", Required: false, DisplayOrder: 1},
		}

		mockSettings.On("GetShortAnswerQuestions").Return(questions, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getShortAnswerQuestions))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ShortAnswerQuestionsResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Len(t, body.Data.Questions, 2)

		mockSettings.AssertExpectations(t)
	})
}

func TestUpdateShortAnswerQuestions(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should update questions", func(t *testing.T) {
		questions := []store.ShortAnswerQuestion{
			{ID: "q1", Question: "Why?", Required: true, DisplayOrder: 0},
		}

		mockSettings.On("UpdateShortAnswerQuestions", questions).Return(nil).Once()

		body := `{"questions":[{"id":"q1","question":"Why?","required":true,"display_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for duplicate question IDs", func(t *testing.T) {
		body := `{"questions":[{"id":"q1","question":"A?","required":true,"display_order":0},{"id":"q1","question":"B?","required":false,"display_order":1}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		err = json.NewDecoder(rr.Body).Decode(&errBody)
		require.NoError(t, err)
		assert.Contains(t, errBody.Error, "duplicate question ID")
	})

	t.Run("should return 400 for empty questions array", func(t *testing.T) {
		body := `{}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateShortAnswerQuestions))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}

func TestGetReviewsPerApp(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return current value", func(t *testing.T) {
		mockSettings.On("GetReviewsPerApplication").Return(3, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getReviewsPerApp))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data ReviewsPerAppResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&body)
		require.NoError(t, err)
		assert.Equal(t, 3, body.Data.ReviewsPerApplication)

		mockSettings.AssertExpectations(t)
	})
}

func TestSetReviewsPerApp(t *testing.T) {
	app := newTestApplication(t)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should set valid value", func(t *testing.T) {
		mockSettings.On("SetReviewsPerApplication", 5).Return(nil).Once()

		body := `{"reviews_per_application":5}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var respBody struct {
			Data ReviewsPerAppResponse `json:"data"`
		}
		err = json.NewDecoder(rr.Body).Decode(&respBody)
		require.NoError(t, err)
		assert.Equal(t, 5, respBody.Data.ReviewsPerApplication)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for value over 10", func(t *testing.T) {
		body := `{"reviews_per_application":11}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should return 400 for value of 0", func(t *testing.T) {
		body := `{"reviews_per_application":0}`
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setReviewsPerApp))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})
}
