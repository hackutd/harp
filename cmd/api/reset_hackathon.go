package main

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/hackutd/portal/internal/store"
)

// A full reset can carry thousands of resume objects, so the cleanup runs
// detached from the request with a bounded fan-out.
const (
	resumeDeleteConcurrency = 16
	resumeDeleteTimeout     = 10 * time.Minute
)

type ResetHackathonPayload struct {
	ResetApplications  bool `json:"reset_applications"`
	ResetScans         bool `json:"reset_scans"`
	ResetScanTypes     bool `json:"reset_scan_types"`
	ResetSchedule      bool `json:"reset_schedule"`
	ResetSettings      bool `json:"reset_settings"`
	ResetNotifications bool `json:"reset_notifications"`
	ResetSponsors      bool `json:"reset_sponsors"`
	ResetFAQs          bool `json:"reset_faqs"`
	ResetConfig        bool `json:"reset_config"`
}

func (p ResetHackathonPayload) toStoreOptions() store.ResetOptions {
	return store.ResetOptions{
		Applications:  p.ResetApplications,
		Scans:         p.ResetScans,
		ScanTypes:     p.ResetScanTypes,
		Schedule:      p.ResetSchedule,
		Notifications: p.ResetNotifications,
		Settings:      p.ResetSettings,
		Sponsors:      p.ResetSponsors,
		FAQs:          p.ResetFAQs,
		Config:        p.ResetConfig,
	}
}

type ResetHackathonResponse struct {
	ResetApplications  bool `json:"reset_applications"`
	ResetScans         bool `json:"reset_scans"`
	ResetScanTypes     bool `json:"reset_scan_types"`
	ResetSchedule      bool `json:"reset_schedule"`
	ResetSettings      bool `json:"reset_settings"`
	ResetNotifications bool `json:"reset_notifications"`
	ResetSponsors      bool `json:"reset_sponsors"`
	ResetFAQs          bool `json:"reset_faqs"`
	ResetConfig        bool `json:"reset_config"`
	// ResumesDeleted counts the resume files queued for removal from object
	// storage. Deletion happens in the background, so a file may still fail;
	// failures are logged server-side.
	ResumesDeleted int `json:"resumes_deleted"`
}

// resetHackathonHandler resets hackathon data based on options
//
//	@Summary		Reset hackathon data (Super Admin)
//	@Description	Resets selected hackathon data (applications and walk-in queue, scans, scan types, schedule, notifications, sponsors, FAQs, settings, per-cycle config). Resetting config also closes applications. Database work is performed in a single transaction; resume files are removed from object storage in the background.
//	@Tags			superadmin
//	@Accept			json
//	@Produce		json
//	@Param			options	body		ResetHackathonPayload	true	"Reset options"
//	@Success		200		{object}	ResetHackathonResponse
//	@Failure		400		{object}	object{error=string}
//	@Failure		401		{object}	object{error=string}
//	@Failure		403		{object}	object{error=string}
//	@Failure		500		{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/reset-hackathon [post]
func (app *application) resetHackathonHandler(w http.ResponseWriter, r *http.Request) {
	var req ResetHackathonPayload
	if err := readJSON(w, r, &req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if err := Validate.Struct(req); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	opts := req.toStoreOptions()
	if !opts.Any() {
		app.badRequestResponse(w, r, errors.New("at least one reset option must be selected"))
		return
	}

	resumePaths, err := app.store.Hackathon.Reset(r.Context(), opts)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	resumesQueued := 0
	if len(resumePaths) > 0 {
		if app.gcsClient == nil {
			app.logger.Warnw("resume files left in object storage: no GCS client configured", "count", len(resumePaths))
		} else {
			resumesQueued = len(resumePaths)
			go app.deleteResumeObjects(resumePaths)
		}
	}

	response := ResetHackathonResponse{
		ResetApplications:  req.ResetApplications,
		ResetScans:         req.ResetScans,
		ResetScanTypes:     req.ResetScanTypes,
		ResetSchedule:      req.ResetSchedule,
		ResetSettings:      req.ResetSettings,
		ResetNotifications: req.ResetNotifications,
		ResetSponsors:      req.ResetSponsors,
		ResetFAQs:          req.ResetFAQs,
		ResetConfig:        req.ResetConfig,
		ResumesDeleted:     resumesQueued,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}

// deleteResumeObjects removes resume files from object storage on a best-effort
// basis, using its own context so the work outlives the request. Individual
// failures are logged rather than surfaced — the rows are already gone.
func (app *application) deleteResumeObjects(paths []string) {
	ctx, cancel := context.WithTimeout(context.Background(), resumeDeleteTimeout)
	defer cancel()

	var (
		wg     sync.WaitGroup
		failed atomic.Int64
		sem    = make(chan struct{}, resumeDeleteConcurrency)
	)

	for _, path := range paths {
		wg.Add(1)
		sem <- struct{}{}

		go func(path string) {
			defer wg.Done()
			defer func() { <-sem }()

			if err := app.gcsClient.DeleteObject(ctx, path); err != nil {
				failed.Add(1)
				app.logger.Errorw("failed to delete resume from object storage", "path", path, "error", err)
			}
		}(path)
	}

	wg.Wait()

	app.logger.Infow("resume cleanup finished",
		"total", len(paths),
		"deleted", int64(len(paths))-failed.Load(),
		"failed", failed.Load(),
	)
}
