package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const detectorExample = `{"ai_score":0.5956428647041321,"verdict":"ai","classes":{"human":0.4043571352958679,"ai":0.5150407552719116,"ai_edited":0.010439506731927395,"humanized":0.07016260176897049}}`

type aiDetectorTransport func(*http.Request) (*http.Response, error)

func (f aiDetectorTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestUpdateAIAssessment(t *testing.T) {
	t.Run("partial update preserves omission and accepts zero and null", func(t *testing.T) {
		app := newTestApplication(t)
		admin := newAdminUser()
		reviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
		var saved store.AIAssessment
		require.NoError(t, json.Unmarshal([]byte(detectorExample), &saved))
		zero := 0.0
		saved.Classes.Human = &zero
		saved.Verdict = nil
		reviews.On("UpdateAIAssessment", "app-1", admin.ID, mock.MatchedBy(func(p store.AIAssessmentPatch) bool {
			return !p.AIScore.Set && p.Verdict.Set && p.Verdict.Value == nil &&
				p.Classes.Human.Set && p.Classes.Human.Value != nil && *p.Classes.Human.Value == 0 &&
				!p.Classes.AI.Set && !p.Classes.AIEdited.Set && !p.Classes.Humanized.Set
		})).Return(&saved, nil).Once()
		router := chi.NewRouter()
		router.Patch("/{applicationID}", app.updateAIAssessment)
		r := setUserContext(httptest.NewRequest(http.MethodPatch, "/app-1", strings.NewReader(`{"verdict":null,"classes":{"human":0}}`)), admin)
		w := executeRequest(r, router)
		require.Equal(t, http.StatusOK, w.Code)
		var body struct {
			Data store.AIAssessment `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.Equal(t, saved, body.Data)
		reviews.AssertExpectations(t)
	})

	for _, payload := range []string{
		`{}`, `{"classes":{}}`, `{"ai_score":1.1}`, `{"classes":{"ai":-0.1}}`,
		`{"verdict":"unknown"}`, `{"ai_score":"0.5"}`, `{"classes":{"unknown":0.5}}`, `{"ai_percent":50}`,
	} {
		t.Run("reject "+payload, func(t *testing.T) {
			app := newTestApplication(t)
			router := chi.NewRouter()
			router.Patch("/{applicationID}", app.updateAIAssessment)
			r := setUserContext(httptest.NewRequest(http.MethodPatch, "/app-1", strings.NewReader(payload)), newAdminUser())
			require.Equal(t, http.StatusBadRequest, executeRequest(r, router).Code)
			app.store.ApplicationReviews.(*store.MockApplicationReviewsStore).AssertNotCalled(t, "UpdateAIAssessment", mock.Anything, mock.Anything, mock.Anything)
		})
	}

	for _, tc := range []struct {
		name   string
		err    error
		status int
	}{
		{"unassigned", store.ErrNotFound, http.StatusNotFound},
		{"database failure", errors.New("database unavailable"), http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			app := newTestApplication(t)
			admin := newAdminUser()
			app.store.ApplicationReviews.(*store.MockApplicationReviewsStore).On("UpdateAIAssessment", "app-1", admin.ID, mock.Anything).Return(nil, tc.err).Once()
			router := chi.NewRouter()
			router.Patch("/{applicationID}", app.updateAIAssessment)
			r := setUserContext(httptest.NewRequest(http.MethodPatch, "/app-1", strings.NewReader(`{"ai_score":0}`)), admin)
			require.Equal(t, tc.status, executeRequest(r, router).Code)
		})
	}
}

func TestCalculateAIPercentPersistsAssessment(t *testing.T) {
	for _, tc := range []struct {
		name         string
		status       int
		body         string
		transportErr error
		want         int
	}{
		{"success", http.StatusOK, detectorExample, nil, http.StatusOK},
		{"upstream rejected token", http.StatusUnauthorized, `{"error":"unauthorized"}`, nil, http.StatusBadGateway},
		{"missing fields", http.StatusOK, `{"verdict":"ai","classes":{}}`, nil, http.StatusBadGateway},
		{"out of range", http.StatusOK, strings.Replace(detectorExample, "0.5956428647041321", "1.5", 1), nil, http.StatusBadGateway},
		{"malformed JSON", http.StatusOK, `not json`, nil, http.StatusBadGateway},
		{"oversized body", http.StatusOK, `{"verdict":"` + strings.Repeat("a", 64<<10) + `"}`, nil, http.StatusBadGateway},
		{"network failure", 0, "", errors.New("connection refused"), http.StatusBadGateway},
		{"timeout", 0, "", context.DeadlineExceeded, http.StatusGatewayTimeout},
	} {
		t.Run(tc.name, func(t *testing.T) {
			app := newTestApplication(t)
			admin := newAdminUser()
			app.config.aiDetectorURL = "https://detector.test/detect"
			app.config.aiDetectorToken = "test-detector-token"
			reviews := app.store.ApplicationReviews.(*store.MockApplicationReviewsStore)
			reviews.On("CheckAssignment", "app-1", admin.ID).Return(nil).Once()
			app.store.Application.(*store.MockApplicationStore).On("GetByID", "app-1").Return(&store.Application{
				ID: "app-1", Responses: json.RawMessage(`{"saq_1":"First","saq_2":"Second","saq_3":"Third","renamed_question":"Fourth","optional":null,"empty":"  ","numeric":42,"first_name":"Private"}`),
			}, nil).Once()
			app.store.Settings.(*store.MockSettingsStore).On("GetApplicationSchema").Return([]store.ApplicationSchemaField{
				{ID: "renamed_question", Section: "short_answers", DisplayOrder: 4},
				{ID: "saq_2", Section: "short_answers", DisplayOrder: 2},
				{ID: "saq_1", Section: "short_answers", DisplayOrder: 1},
				{ID: "saq_3", Section: "short_answers", DisplayOrder: 3},
				{ID: "optional", Section: "short_answers", DisplayOrder: 5},
				{ID: "empty", Section: "short_answers", DisplayOrder: 6},
				{ID: "missing", Section: "short_answers", DisplayOrder: 7},
				{ID: "numeric", Section: "short_answers", DisplayOrder: 8},
				{ID: "first_name", Section: "personal"},
			}, nil).Once()
			var saved store.AIAssessment
			require.NoError(t, json.Unmarshal([]byte(detectorExample), &saved))
			if tc.want == http.StatusOK {
				reviews.On("UpdateAIAssessment", "app-1", admin.ID, mock.MatchedBy(func(p store.AIAssessmentPatch) bool {
					return p.AIScore.Set && p.AIScore.Value != nil && *p.AIScore.Value == *saved.AIScore &&
						p.Verdict.Set && p.Verdict.Value != nil && *p.Verdict.Value == "ai" &&
						p.Classes.Human.Set && p.Classes.AI.Set && p.Classes.AIEdited.Set && p.Classes.Humanized.Set
				})).Return(&saved, nil).Once()
			}
			app.aiDetectorClient = &http.Client{Transport: aiDetectorTransport(func(r *http.Request) (*http.Response, error) {
				require.Equal(t, http.MethodPost, r.Method)
				require.Equal(t, "https://detector.test/detect", r.URL.String())
				require.Equal(t, "Bearer test-detector-token", r.Header.Get("Authorization"))
				require.Equal(t, "application/json", r.Header.Get("Content-Type"))
				var payload CalculateAIPercentPayload
				require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
				require.Equal(t, "First\nSecond\nThird\nFourth", payload.ShortAnswers)
				if tc.transportErr != nil {
					return nil, tc.transportErr
				}
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: make(http.Header)}, nil
			})}
			router := chi.NewRouter()
			router.Post("/{applicationID}", app.calculateAIPercent)
			r := setUserContext(httptest.NewRequest(http.MethodPost, "/app-1", nil), admin)
			w := executeRequest(r, router)
			require.Equal(t, tc.want, w.Code)
			if tc.want == http.StatusOK {
				var body struct {
					Data store.AIAssessment `json:"data"`
				}
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
				require.Equal(t, saved, body.Data)
			} else {
				reviews.AssertNotCalled(t, "UpdateAIAssessment", mock.Anything, mock.Anything, mock.Anything)
			}
			reviews.AssertExpectations(t)
		})
	}
}

func TestCalculateAIPercentChecksAssignmentBeforeDetector(t *testing.T) {
	app := newTestApplication(t)
	admin := newAdminUser()
	app.store.ApplicationReviews.(*store.MockApplicationReviewsStore).On("CheckAssignment", "app-1", admin.ID).Return(store.ErrNotFound).Once()
	app.aiDetectorClient = &http.Client{Transport: aiDetectorTransport(func(*http.Request) (*http.Response, error) {
		t.Fatal("unassigned reviewer must not call the detector")
		return nil, nil
	})}
	router := chi.NewRouter()
	router.Post("/{applicationID}", app.calculateAIPercent)
	r := setUserContext(httptest.NewRequest(http.MethodPost, "/app-1", nil), admin)
	require.Equal(t, http.StatusNotFound, executeRequest(r, router).Code)
	app.store.Application.(*store.MockApplicationStore).AssertNotCalled(t, "GetByID", mock.Anything)
}

func TestCalculateAIPercentRequiresDetectorConfig(t *testing.T) {
	for _, tc := range []struct{ name, url, token string }{
		{"missing URL", "", "test-detector-token"},
		{"missing token", "https://detector.test/detect", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			app := newTestApplication(t)
			admin := newAdminUser()
			app.config.aiDetectorURL = tc.url
			app.config.aiDetectorToken = tc.token
			app.store.ApplicationReviews.(*store.MockApplicationReviewsStore).On("CheckAssignment", "app-1", admin.ID).Return(nil).Once()
			app.aiDetectorClient = &http.Client{Transport: aiDetectorTransport(func(*http.Request) (*http.Response, error) {
				t.Fatal("unconfigured detector must not be called")
				return nil, nil
			})}
			router := chi.NewRouter()
			router.Post("/{applicationID}", app.calculateAIPercent)
			r := setUserContext(httptest.NewRequest(http.MethodPost, "/app-1", nil), admin)
			require.Equal(t, http.StatusServiceUnavailable, executeRequest(r, router).Code)
			app.store.Application.(*store.MockApplicationStore).AssertNotCalled(t, "GetByID", mock.Anything)
		})
	}
}
