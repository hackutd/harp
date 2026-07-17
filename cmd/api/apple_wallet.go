package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/hackutd/portal/internal/applewallet"
)

const appleWalletPassMIMEType = "application/vnd.apple.pkpass"

type appleWalletConfig struct {
	enabled               bool
	passTypeIdentifier    string
	teamIdentifier        string
	organizationName      string
	description           string
	certificateBase64     string
	privateKeyBase64      string
	wwdrCertificateBase64 string
	iconPath              string
}

type appleWalletPassGenerator interface {
	Generate(userID, email string) ([]byte, error)
}

type appleWalletStatusResponse struct {
	Available bool `json:"available"`
}

func newAppleWalletPassGenerator(config appleWalletConfig) (appleWalletPassGenerator, error) {
	if !config.enabled {
		return nil, nil
	}

	certificate, err := decodeAppleWalletSecret(
		"APPLE_WALLET_CERTIFICATE_BASE64",
		config.certificateBase64,
	)
	if err != nil {
		return nil, err
	}
	privateKey, err := decodeAppleWalletSecret(
		"APPLE_WALLET_PRIVATE_KEY_BASE64",
		config.privateKeyBase64,
	)
	if err != nil {
		return nil, err
	}
	wwdrCertificate, err := decodeAppleWalletSecret(
		"APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
		config.wwdrCertificateBase64,
	)
	if err != nil {
		return nil, err
	}

	icon, err := os.ReadFile(config.iconPath)
	if err != nil {
		return nil, fmt.Errorf("read Apple Wallet icon: %w", err)
	}

	generator, err := applewallet.New(applewallet.Config{
		PassTypeIdentifier: config.passTypeIdentifier,
		TeamIdentifier:     config.teamIdentifier,
		OrganizationName:   config.organizationName,
		Description:        config.description,
		Certificate:        certificate,
		PrivateKey:         privateKey,
		WWDRCertificate:    wwdrCertificate,
		Icon:               icon,
	})
	if err != nil {
		return nil, fmt.Errorf("configure Apple Wallet passes: %w", err)
	}

	return generator, nil
}

func decodeAppleWalletSecret(name, value string) ([]byte, error) {
	if value == "" {
		return nil, fmt.Errorf("%s is required when Apple Wallet is enabled", name)
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", name, err)
	}
	return decoded, nil
}

// getAppleWalletStatusHandler reports whether this deployment can issue passes.
func (app *application) getAppleWalletStatusHandler(w http.ResponseWriter, r *http.Request) {
	if err := app.jsonResponse(w, http.StatusOK, appleWalletStatusResponse{
		Available: app.appleWalletPasses != nil,
	}); err != nil {
		app.internalServerError(w, r, err)
	}
}

// getAppleWalletPassHandler returns a signed pass containing the current
// hacker's QR code.
//
//	@Summary		Download my Apple Wallet pass
//	@Description	Returns a signed Apple Wallet pass containing the authenticated hacker's QR code
//	@Tags			hackers
//	@Produce		application/vnd.apple.pkpass
//	@Success		200	{file}		binary
//	@Failure		401	{object}	object{error=string}
//	@Failure		503	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/wallet/apple-pass [get]
func (app *application) getAppleWalletPassHandler(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r.Context())
	if user == nil {
		app.unauthorizedErrorResponse(w, r, errors.New("user not in context"))
		return
	}
	if app.appleWalletPasses == nil {
		if err := writeJSONError(w, http.StatusServiceUnavailable, "Apple Wallet passes are not available"); err != nil {
			app.internalServerError(w, r, err)
		}
		return
	}

	pass, err := app.appleWalletPasses.Generate(user.ID, user.Email)
	if err != nil {
		app.internalServerError(w, r, fmt.Errorf("generate Apple Wallet pass: %w", err))
		return
	}

	w.Header().Set("Content-Type", appleWalletPassMIMEType)
	w.Header().Set("Content-Disposition", `attachment; filename="hackutd-hacker-pass.pkpass"`)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pass)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(pass); err != nil {
		app.logger.Errorw("failed to write Apple Wallet pass", "user_id", user.ID, "error", err)
	}
}
