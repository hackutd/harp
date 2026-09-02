package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const testReceiptObjectID = "0123456789abcdef0123456789abcdef"

// testTravelApprovedAmountCents is the committed award carried by the eligible
// test application, chosen non-round so assertions can't pass by accident.
const testTravelApprovedAmountCents = int64(12345)

// newTravelEligibleApplication returns an accepted application with a confirmed
// RSVP, approved travel, and a pending travel RSVP.
func newTravelEligibleApplication(userID string) *store.Application {
	approvedAmount := testTravelApprovedAmountCents
	return &store.Application{
		ID:                        "app-1",
		UserID:                    userID,
		Status:                    store.StatusAccepted,
		Responses:                 json.RawMessage(`{}`),
		RSVPStatus:                store.RSVPConfirmed,
		RSVPResponses:             json.RawMessage(`{}`),
		TravelStatus:              store.TravelApproved,
		TravelApprovedAmountCents: &approvedAmount,
		TravelRSVPStatus:          store.RSVPPending,
		TravelRSVPResponses:       json.RawMessage(`{}`),
		CreatedAt:                 time.Now(),
		UpdatedAt:                 time.Now(),
	}
}

func newTravelRSVPSchema() []store.ApplicationSchemaField {
	return []store.ApplicationSchemaField{
		{ID: "travel_rsvp_mode", Type: "select", Label: "How will you be traveling?", Required: true, Options: []string{"Driving", "Flying"}},
		{ID: "flight_numbers", Type: "text", Label: "Flight number(s)", Required: false, Validation: map[string]interface{}{"required_if": "travel_rsvp_mode=Flying"}},
		{ID: "payment_method", Type: "select", Label: "How would you like to be paid?", Required: true, Options: []string{"Zelle", "Venmo"}},
	}
}

func validTestReceiptPath(userID string) string {
	return "hackathons/hackutd-2026/travel-receipts/" + userID + "/" + testReceiptObjectID + ".pdf"
}

func TestGetMyTravelRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	t.Run("should return travel rsvp state with schema for eligible application", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()
		mockSettings.On("GetTravelRSVPEnabled").Return(true, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelRSVPResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPPending, envelope.Data.TravelRSVPStatus)
		assert.True(t, envelope.Data.TravelRSVPEnabled)
		assert.Len(t, envelope.Data.TravelRSVPSchema, 3)
		require.NotNil(t, envelope.Data.TravelApprovedAmountCents)
		assert.Equal(t, testTravelApprovedAmountCents, *envelope.Data.TravelApprovedAmountCents)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 403 when application is not accepted", func(t *testing.T) {
		user := newTestUser()
		submitted := newTravelEligibleApplication(user.ID)
		submitted.Status = store.StatusSubmitted

		mockApps.On("GetByUserID", user.ID).Return(submitted, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 403 when spot is not claimed", func(t *testing.T) {
		user := newTestUser()
		noRSVP := newTravelEligibleApplication(user.ID)
		noRSVP.RSVPStatus = store.RSVPPending

		mockApps.On("GetByUserID", user.ID).Return(noRSVP, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 403 when travel is not approved", func(t *testing.T) {
		user := newTestUser()
		notApproved := newTravelEligibleApplication(user.ID)
		notApproved.TravelStatus = store.TravelPending

		mockApps.On("GetByUserID", user.ID).Return(notApproved, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 404 when application does not exist", func(t *testing.T) {
		user := newTestUser()

		mockApps.On("GetByUserID", user.ID).Return(nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, user)

		rr := executeRequest(req, http.HandlerFunc(app.getMyTravelRSVPHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestSubmitMyTravelRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)

	newRequest := func(t *testing.T, body string, user *store.User) *http.Request {
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		return setUserContext(req, user)
	}

	t.Run("should confirm travel rsvp when driving without receipts", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()
		mockApps.On("SubmitTravelRSVP", mock.MatchedBy(func(a *store.Application) bool {
			return a.TravelRSVPStatus == store.RSVPConfirmed && len(a.TravelReceiptPaths) == 0
		})).Return(nil).Once()
		mockSettings.On("GetTravelRSVPEnabled").Return(true, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed","responses":{"travel_rsvp_mode":"Driving","payment_method":"Zelle"}}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelRSVPResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPConfirmed, envelope.Data.TravelRSVPStatus)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should confirm travel rsvp when flying with receipts", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)
		receiptPath := validTestReceiptPath(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()
		mockApps.On("SubmitTravelRSVP", mock.MatchedBy(func(a *store.Application) bool {
			return a.TravelRSVPStatus == store.RSVPConfirmed &&
				len(a.TravelReceiptPaths) == 1 && a.TravelReceiptPaths[0] == receiptPath
		})).Return(nil).Once()
		mockSettings.On("GetTravelRSVPEnabled").Return(true, nil).Once()

		body := `{"status":"confirmed","responses":{"travel_rsvp_mode":"Flying","flight_numbers":"AA123","payment_method":"Zelle"},"receipt_paths":["` + receiptPath + `"]}`
		rr := executeRequest(
			newRequest(t, body, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should decline travel rsvp without requiring responses", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()
		mockApps.On("SubmitTravelRSVP", mock.MatchedBy(func(a *store.Application) bool {
			return a.TravelRSVPStatus == store.RSVPDeclined && string(a.TravelRSVPResponses) == `{}` && len(a.TravelReceiptPaths) == 0
		})).Return(nil).Once()
		mockSettings.On("GetTravelRSVPEnabled").Return(true, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"declined"}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when flying without receipts", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()

		body := `{"status":"confirmed","responses":{"travel_rsvp_mode":"Flying","flight_numbers":"AA123","payment_method":"Zelle"}}`
		rr := executeRequest(
			newRequest(t, body, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errBody))
		assert.Contains(t, errBody.Error, "receipt")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 when flying without flight numbers", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()

		body := `{"status":"confirmed","responses":{"travel_rsvp_mode":"Flying","payment_method":"Zelle"},"receipt_paths":["` + validTestReceiptPath(user.ID) + `"]}`
		rr := executeRequest(
			newRequest(t, body, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		var errBody struct {
			Error string `json:"error"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errBody))
		assert.Contains(t, errBody.Error, "flight_numbers is required")

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should not require flight numbers when driving", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()
		mockApps.On("SubmitTravelRSVP", mock.AnythingOfType("*store.Application")).Return(nil).Once()
		mockSettings.On("GetTravelRSVPEnabled").Return(true, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed","responses":{"travel_rsvp_mode":"Driving","payment_method":"Venmo"}}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 400 for invalid receipt path", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()

		body := `{"status":"confirmed","responses":{"travel_rsvp_mode":"Driving","payment_method":"Zelle"},"receipt_paths":["hackathons/x/travel-receipts/other-user/` + testReceiptObjectID + `.pdf"]}`
		rr := executeRequest(
			newRequest(t, body, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})

	t.Run("should return 403 when travel is not approved", func(t *testing.T) {
		user := newTestUser()
		notApproved := newTravelEligibleApplication(user.ID)
		notApproved.TravelStatus = store.TravelRejected

		mockApps.On("GetByUserID", user.ID).Return(notApproved, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed"}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when travel rsvp already submitted", func(t *testing.T) {
		user := newTestUser()
		alreadyConfirmed := newTravelEligibleApplication(user.ID)
		alreadyConfirmed.TravelRSVPStatus = store.RSVPConfirmed

		mockApps.On("GetByUserID", user.ID).Return(alreadyConfirmed, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"declined"}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when store reports concurrent submit", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetTravelRSVPSchema").Return([]store.ApplicationSchemaField{}, nil).Once()
		mockApps.On("SubmitTravelRSVP", mock.AnythingOfType("*store.Application")).Return(store.ErrConflict).Once()

		rr := executeRequest(
			newRequest(t, `{"status":"confirmed"}`, user),
			http.HandlerFunc(app.submitMyTravelRSVPHandler),
		)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
	})
}

func TestGenerateTravelReceiptUploadURL(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockSettings := app.store.Settings.(*store.MockSettingsStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	newRequest := func(t *testing.T, body string, user *store.User) *http.Request {
		req, err := http.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		return setUserContext(req, user)
	}

	t.Run("should generate upload url for pdf receipt", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()
		mockGCS.On(
			"GenerateUploadURL",
			mock.Anything,
			mock.MatchedBy(func(path string) bool {
				return strings.HasPrefix(path, "hackathons/hackutd-2026/travel-receipts/"+user.ID+"/") && strings.HasSuffix(path, ".pdf")
			}),
		).Return("https://upload.example.com", nil).Once()

		rr := executeRequest(
			newRequest(t, `{"content_type":"application/pdf"}`, user),
			http.HandlerFunc(app.generateTravelReceiptUploadURLHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TravelReceiptUploadURLResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
		assert.Equal(t, "https://upload.example.com", body.Data.UploadURL)
		assert.True(t, validTravelReceiptObjectPath(body.Data.ReceiptPath, user.ID))

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should generate upload url for image receipt", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()
		mockSettings.On("GetHackathonName").Return("HackUTD 2026", nil).Once()
		mockGCS.On(
			"GenerateImageUploadURL",
			mock.Anything,
			mock.MatchedBy(func(path string) bool {
				return strings.HasSuffix(path, ".png")
			}),
			"image/png",
		).Return("https://upload.example.com/img", nil).Once()

		rr := executeRequest(
			newRequest(t, `{"content_type":"image/png"}`, user),
			http.HandlerFunc(app.generateTravelReceiptUploadURLHandler),
		)
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockSettings.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 400 for disallowed content type", func(t *testing.T) {
		user := newTestUser()
		eligible := newTravelEligibleApplication(user.ID)

		mockApps.On("GetByUserID", user.ID).Return(eligible, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"content_type":"application/zip"}`, user),
			http.HandlerFunc(app.generateTravelReceiptUploadURLHandler),
		)
		checkResponseCode(t, http.StatusBadRequest, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 403 when not eligible", func(t *testing.T) {
		user := newTestUser()
		notApproved := newTravelEligibleApplication(user.ID)
		notApproved.TravelStatus = store.TravelPending

		mockApps.On("GetByUserID", user.ID).Return(notApproved, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"content_type":"application/pdf"}`, user),
			http.HandlerFunc(app.generateTravelReceiptUploadURLHandler),
		)
		checkResponseCode(t, http.StatusForbidden, rr.Code)

		mockApps.AssertExpectations(t)
	})

	t.Run("should return 409 when travel rsvp already submitted", func(t *testing.T) {
		user := newTestUser()
		alreadyConfirmed := newTravelEligibleApplication(user.ID)
		alreadyConfirmed.TravelRSVPStatus = store.RSVPConfirmed

		mockApps.On("GetByUserID", user.ID).Return(alreadyConfirmed, nil).Once()

		rr := executeRequest(
			newRequest(t, `{"content_type":"application/pdf"}`, user),
			http.HandlerFunc(app.generateTravelReceiptUploadURLHandler),
		)
		checkResponseCode(t, http.StatusConflict, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestGetTravelReceiptURLs(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should return signed urls for all receipts", func(t *testing.T) {
		receiptPath := validTestReceiptPath("user-1")
		application := newTravelEligibleApplication("user-1")
		application.TravelRSVPStatus = store.RSVPConfirmed
		application.TravelReceiptPaths = store.StringArray{receiptPath}

		mockApps.On("GetByID", "app-1").Return(application, nil).Once()
		mockGCS.On("GenerateDownloadURL", mock.Anything, receiptPath).Return("https://download.example.com", nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.getTravelReceiptURLsHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var body struct {
			Data TravelReceiptURLsResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
		require.Len(t, body.Data.Receipts, 1)
		assert.Equal(t, receiptPath, body.Data.Receipts[0].Path)
		assert.Equal(t, "https://download.example.com", body.Data.Receipts[0].DownloadURL)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when application has no receipts", func(t *testing.T) {
		application := newTravelEligibleApplication("user-1")

		mockApps.On("GetByID", "app-1").Return(application, nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.getTravelReceiptURLsHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}

func TestValidTravelReceiptObjectPath(t *testing.T) {
	userID := "user-1"

	valid := []string{
		"hackathons/hackutd-2026/travel-receipts/user-1/" + testReceiptObjectID + ".pdf",
		"hackathons/hackutd-2026/travel-receipts/user-1/" + testReceiptObjectID + ".png",
		"hackathons/hackutd-2026/travel-receipts/user-1/" + testReceiptObjectID + ".jpg",
	}
	for _, p := range valid {
		assert.True(t, validTravelReceiptObjectPath(p, userID), p)
	}

	invalid := []string{
		"",
		"hackathons/hackutd-2026/travel-receipts/other-user/" + testReceiptObjectID + ".pdf",
		"hackathons/hackutd-2026/resumes/user-1/" + testReceiptObjectID + ".pdf",
		"hackathons/hackutd-2026/travel-receipts/user-1/" + testReceiptObjectID + ".zip",
		"hackathons/hackutd-2026/travel-receipts/user-1/short.pdf",
		"hackathons//travel-receipts/user-1/" + testReceiptObjectID + ".pdf",
		"other/hackutd-2026/travel-receipts/user-1/" + testReceiptObjectID + ".pdf",
	}
	for _, p := range invalid {
		assert.False(t, validTravelReceiptObjectPath(p, userID), p)
	}
}

func TestTravelRSVPEnabledMiddleware(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("should return 403 when travel rsvps are disabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).On("GetTravelRSVPEnabled").Return(false, nil).Once()

		handler := app.TravelRSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusForbidden, rr.Code)
	})

	t.Run("should allow access when travel rsvps are enabled", func(t *testing.T) {
		app := newTestApplication(t)
		app.store.Settings.(*store.MockSettingsStore).On("GetTravelRSVPEnabled").Return(true, nil).Once()

		handler := app.TravelRSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newTestUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})

	t.Run("should allow super admin to bypass gate", func(t *testing.T) {
		app := newTestApplication(t)

		handler := app.TravelRSVPEnabledMiddleware(ok)
		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, handler)
		checkResponseCode(t, http.StatusOK, rr.Code)
	})
}

func TestTravelRSVPSchemaSettings(t *testing.T) {
	t.Run("should return travel rsvp schema", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("GetTravelRSVPSchema").Return(newTravelRSVPSchema(), nil).Once()

		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.getTravelRSVPSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data TravelRSVPSchemaResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Len(t, envelope.Data.Fields, 3)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should update travel rsvp schema", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("UpdateTravelRSVPSchema", mock.AnythingOfType("[]store.ApplicationSchemaField")).Return(nil).Once()

		body := `{"fields":[{"id":"travel_rsvp_mode","type":"select","label":"Mode","required":true,"options":["Driving","Flying"],"display_order":0,"section_order":0}]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateTravelRSVPSchema))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})

	t.Run("should reject duplicate field ids", func(t *testing.T) {
		app := newTestApplication(t)

		body := `{"fields":[
			{"id":"travel_rsvp_mode","type":"select","label":"A","display_order":0,"section_order":0},
			{"id":"travel_rsvp_mode","type":"text","label":"B","display_order":1,"section_order":0}
		]}`
		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.updateTravelRSVPSchema))
		checkResponseCode(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("should set travel rsvp enabled", func(t *testing.T) {
		app := newTestApplication(t)
		mockSettings := app.store.Settings.(*store.MockSettingsStore)
		mockSettings.On("SetTravelRSVPEnabled", false).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPut, "/", strings.NewReader(`{"enabled":false}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req = setUserContext(req, newSuperAdminUser())

		rr := executeRequest(req, http.HandlerFunc(app.setTravelRSVPEnabled))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockSettings.AssertExpectations(t)
	})
}

func TestResetApplicationTravelRSVP(t *testing.T) {
	app := newTestApplication(t)
	mockApps := app.store.Application.(*store.MockApplicationStore)
	mockGCS := app.gcsClient.(*gcs.MockClient)

	t.Run("should clear the travel rsvp and delete the detached receipts", func(t *testing.T) {
		receiptPath := validTestReceiptPath("user-1")
		reset := newTravelEligibleApplication("user-1")

		mockApps.On("ResetTravelRSVP", "app-1").Return(reset, []string{receiptPath}, nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, receiptPath).Return(nil).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationTravelRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		var envelope struct {
			Data ApplicationResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &envelope))
		assert.Equal(t, store.RSVPPending, envelope.Data.Application.TravelRSVPStatus)
		// The event RSVP is left alone: only the travel form is being redone.
		assert.Equal(t, store.RSVPConfirmed, envelope.Data.Application.RSVPStatus)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should still reset when a receipt cannot be deleted", func(t *testing.T) {
		// The rows are already cleared, so a storage failure must not fail the
		// reset — it only leaves an orphaned object behind, which is logged.
		receiptPath := validTestReceiptPath("user-1")
		reset := newTravelEligibleApplication("user-1")

		mockApps.On("ResetTravelRSVP", "app-1").Return(reset, []string{receiptPath}, nil).Once()
		mockGCS.On("DeleteObject", mock.Anything, receiptPath).Return(assert.AnError).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "app-1")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationTravelRSVPHandler))
		checkResponseCode(t, http.StatusOK, rr.Code)

		mockApps.AssertExpectations(t)
		mockGCS.AssertExpectations(t)
	})

	t.Run("should return 404 when application not found", func(t *testing.T) {
		mockApps.On("ResetTravelRSVP", "nonexistent").Return(nil, nil, store.ErrNotFound).Once()

		req, err := http.NewRequest(http.MethodPost, "/", nil)
		require.NoError(t, err)
		req = setUserContext(req, newSuperAdminUser())
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("applicationID", "nonexistent")
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		rr := executeRequest(req, http.HandlerFunc(app.resetApplicationTravelRSVPHandler))
		checkResponseCode(t, http.StatusNotFound, rr.Code)

		mockApps.AssertExpectations(t)
	})
}
