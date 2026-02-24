package main

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"

	"github.com/hackutd/portal/internal/store"
)

type SendQREmailsResponse struct {
	Total  int      `json:"total"`
	Sent   int      `json:"sent"`
	Failed int      `json:"failed"`
	Errors []string `json:"errors,omitempty"`
}

// sendQREmailsHandler sends personalized QR code emails to all accepted hackers
//
//	@Summary		Send QR code emails (Super Admin)
//	@Description	Generates and sends personalized QR code emails to all accepted hackers. QR encodes the user UUID for check-in scanning.
//	@Tags			superadmin
//	@Produce		json
//	@Success		200	{object}	SendQREmailsResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Failure		500	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/emails/qr [post]
func (app *application) sendQREmailsHandler(w http.ResponseWriter, r *http.Request) {
	users, err := app.store.Application.GetEmailsByStatus(r.Context(), store.StatusAccepted)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	if len(users) == 0 {
		if err := app.jsonResponse(w, http.StatusOK, SendQREmailsResponse{}); err != nil {
			app.internalServerError(w, r, err)
		}
		return
	}

	var (
		sentCount   atomic.Int64
		failedCount atomic.Int64
		mu          sync.Mutex
		errMessages []string
		wg          sync.WaitGroup
		semaphore   = make(chan struct{}, 10)
	)

	for _, u := range users {
		wg.Add(1)
		go func() {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			name := "Hacker"
			if u.FirstName != nil && *u.FirstName != "" {
				name = *u.FirstName
			}

			if err := app.mailer.SendQREmail(u.Email, name, u.UserID); err != nil {
				failedCount.Add(1)
				app.logger.Errorw("failed to send QR email",
					"email", u.Email, "error", err)
				mu.Lock()
				errMessages = append(errMessages, fmt.Sprintf("%s: %s", u.Email, err.Error()))
				mu.Unlock()
				return
			}
			sentCount.Add(1)
		}()
	}

	wg.Wait()

	response := SendQREmailsResponse{
		Total:  len(users),
		Sent:   int(sentCount.Load()),
		Failed: int(failedCount.Load()),
		Errors: errMessages,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
