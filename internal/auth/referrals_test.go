package auth

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/hackutd/harp/internal/store"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

func TestRecordPendingReferral(t *testing.T) {
	logger := zap.NewNop().Sugar()

	newRequest := func(code string) *http.Request {
		req, _ := http.NewRequest(http.MethodPost, "/auth/signinup/code", nil)
		if code != "" {
			req.Header.Set(ReferralCodeHeader, code)
		}
		return req
	}

	t.Run("records the header against the email", func(t *testing.T) {
		appStore := store.NewMockStore()
		referrals := appStore.Referrals.(*store.MockReferralsStore)
		referrals.On("RecordPending", "new@example.com", "insta").Return(nil).Once()

		recordPendingReferral(appStore, logger, newRequest(" insta "), "new@example.com")

		referrals.AssertExpectations(t)
	})

	t.Run("survives a store error", func(t *testing.T) {
		appStore := store.NewMockStore()
		referrals := appStore.Referrals.(*store.MockReferralsStore)
		referrals.On("RecordPending", "new@example.com", "insta").Return(errors.New("db down")).Once()

		recordPendingReferral(appStore, logger, newRequest("insta"), "new@example.com")

		referrals.AssertExpectations(t)
	})

	for name, tc := range map[string]struct {
		req   *http.Request
		email string
	}{
		"no header":       {newRequest(""), "new@example.com"},
		"header too long": {newRequest(strings.Repeat("a", maxReferralCodeLen+1)), "new@example.com"},
		"no email":        {newRequest("insta"), ""},
		"no request":      {nil, "new@example.com"},
	} {
		t.Run("skips "+name, func(t *testing.T) {
			appStore := store.NewMockStore()
			referrals := appStore.Referrals.(*store.MockReferralsStore)

			recordPendingReferral(appStore, logger, tc.req, tc.email)

			referrals.AssertNotCalled(t, "RecordPending", mock.Anything, mock.Anything)
		})
	}
}
