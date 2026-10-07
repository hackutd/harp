package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/hackutd/harp/internal/store"
	"go.uber.org/zap"
)

// ReferralCodeHeader carries the ?s= code the portal saved from a referral
// link. The portal adds it to the magic-link and Google sign-in requests, the
// two places the backend learns an email before the user row exists.
const ReferralCodeHeader = "X-Referral-Code"

// maxReferralCodeLen matches the longest code the referrals API accepts.
const maxReferralCodeLen = 64

// recordPendingReferral holds the request's referral code against email until
// the user row is created. It is best effort: a lost attribution must never
// cost someone their sign-in, so failures are logged rather than returned.
func recordPendingReferral(appStore store.Storage, logger *zap.SugaredLogger, r *http.Request, email string) {
	if r == nil || email == "" {
		return
	}
	code := strings.TrimSpace(r.Header.Get(ReferralCodeHeader))
	if code == "" || len(code) > maxReferralCodeLen {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := appStore.Referrals.RecordPending(ctx, email, code); err != nil {
		logger.Warnw("failed to record pending referral", "error", err, "referral_code", code)
	}
}
