package main

import (
	"context"
	"errors"
	"expvar"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/go-chi/cors"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/ratelimiter"
	"github.com/hackutd/harp/internal/store"
	"github.com/supertokens/supertokens-golang/supertokens"
	httpSwagger "github.com/swaggo/http-swagger"
	"go.uber.org/zap"
)

type application struct {
	config            config
	store             store.Storage
	logger            *zap.SugaredLogger
	mailer            mailer.Client
	gcsClient         gcs.Client
	appleWalletPasses appleWalletPassGenerator
	// rateLimiter buckets requests by verified session user ID; ipRateLimiter
	// is the fallback for requests without one. Split so the shared-IP budget
	// (a venue full of hackers behind one NAT) can be tuned independently.
	rateLimiter   ratelimiter.Limiter
	ipRateLimiter ratelimiter.Limiter
	// sessionUserID resolves the SuperTokens user ID for a request without
	// requiring a session. Injected so tests can stub it.
	sessionUserID    sessionUserIDResolver
	dispatcherCancel context.CancelFunc
}

type config struct {
	addr             string
	db               dbConfig
	env              string
	appURL           string
	frontendURL      string
	mail             mailer.Config
	gcs              gcsConfig
	auth             authConfig
	rateLimiter      ratelimiter.Config
	supertokens      supertokensConfig
	publicCORSOrigin string
	vapid            vapidConfig
	appleWallet      appleWalletConfig
}

type vapidConfig struct {
	publicKey  string
	privateKey string
	subject    string
}

type supertokensConfig struct {
	appName            string
	connectionURI      string
	apiKey             string
	googleClientID     string
	googleClientSecret string
}

type authConfig struct {
	basic        basicConfig
	publicAPIKey string
}

type basicConfig struct {
	user string
	pass string
}
type gcsConfig struct {
	bucketName string
}

type dbConfig struct {
	addr         string
	maxOpenConns int
	maxIdleConns int
	maxIdleTime  string // TODO: LOOK INTO NOT USING A STRING FOR TIME
}

const swaggerTagsSorter = `(a, b) => {
	const order = [
		"health",
		"auth",
		"public",
		"hackers",
		"admin/applications",
		"admin/reviews",
		"admin/scans",
		"admin/schedule",
		"admin/sponsors",
		"admin/faq",
		"superadmin/applications",
		"superadmin/emails",
		"superadmin/hacker-links",
		"superadmin/settings",
		"superadmin/users"
	];
	const index = (tag) => {
		const i = order.indexOf(tag);
		return i === -1 ? 999 : i;
	};
	return index(a) - index(b) || a.localeCompare(b);
}`

func (app *application) mount() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS
	allowedOrigins := []string{}
	if app.config.frontendURL != app.config.appURL {
		allowedOrigins = append(allowedOrigins, app.config.frontendURL)
	}
	if app.config.publicCORSOrigin != "" {
		allowedOrigins = append(allowedOrigins, app.config.publicCORSOrigin)
	}
	if len(allowedOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   allowedOrigins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   append([]string{"Content-Type", "X-API-Key"}, supertokens.GetAllCORSHeaders()...),
			AllowCredentials: true,
		}))
	}

	// SuperTokens middleware handles /auth/ routes automatically.
	// Applied at root level so it intercepts /auth/* requests.
	r.Use(supertokens.Middleware)

	r.Route("/v1", func(r chi.Router) {
		// Ratelimiter. Scoped to the API so the SPA shell and static assets
		// (served from /*) are never throttled; /auth/* is handled by the
		// SuperTokens middleware above and never reaches this router.
		if app.config.rateLimiter.Enabled {
			r.Use(app.RateLimiterMiddleware)
		}

		// Public API (key auth)
		r.Route("/public", func(r chi.Router) {
			r.Use(app.APIKeyMiddleware)
			r.Get("/schedule", app.getPublicScheduleHandler)
			r.Get("/sponsors", app.getPublicSponsorsHandler)
			r.Get("/faq", app.getPublicFAQHandler)
		})

		// Legal document links. Unauthenticated on purpose: the login page
		// tells hackers they agree to these before they have a session.
		r.Get("/legal", app.getLegalConfigHandler)

		// Auth endpoints not handled by SuperTokens
		r.Get("/auth/check-email", app.checkEmailAuthMethodHandler)
		r.With(app.AuthRequiredMiddleware).Get("/auth/me", app.getCurrentUserHandler)
		// Basic auth
		r.With(app.BasicAuthMiddleware).Get("/health", app.healthCheckHandler)
		r.With(app.BasicAuthMiddleware).Get("/debug/vars", expvar.Handler().ServeHTTP)

		// Swagger docs
		r.With(app.BasicAuthMiddleware).Get("/swagger/*", httpSwagger.Handler(
			httpSwagger.URL("doc.json"),
			httpSwagger.UIConfig(map[string]string{
				"tagsSorter": swaggerTagsSorter,
			}),
		))

		r.Group(func(r chi.Router) {
			r.Use(app.AuthRequiredMiddleware)

			// Push notifications (any authenticated user)
			r.Route("/notifications", func(r chi.Router) {
				r.Get("/feed", app.getNotificationFeedHandler)
				r.Get("/vapid-public-key", app.getVapidPublicKeyHandler)
				r.Post("/subscribe", app.subscribePushHandler)
				r.Delete("/subscribe", app.unsubscribePushHandler)
			})

			// Hacker Routes
			r.Get("/schedule", app.getHackerScheduleHandler)
			r.Get("/schedule/date-range", app.getHackerScheduleDateRange)
			r.Get("/faq", app.getHackerFAQHandler)
			r.Get("/hacker-links", app.getHackerLinksHandler)
			r.Get("/hacker-pack", app.getHackerPackHandler)
			r.Get("/points-config", app.getPointsConfigHandler)
			r.Get("/hackathon-config", app.getHackathonConfigHandler)
			r.Delete("/users/me", app.deleteMyAccountHandler)
			r.Get("/wallet/apple-pass/status", app.getAppleWalletStatusHandler)
			r.Get("/wallet/apple-pass", app.getAppleWalletPassHandler)

			r.Route("/applications", func(r chi.Router) {
				r.Get("/me", app.getOrCreateApplicationHandler)
				r.Get("/enabled", app.getApplicationsEnabled)
				// Viewing your own resume is allowed in any status,
				// even after applications close.
				r.Get("/me/resume-url", app.getMyResumeDownloadURLHandler)

				// RSVP is gated by its own toggle, not ApplicationsEnabled:
				// applications are typically closed by the time acceptances go out.
				r.Get("/me/rsvp", app.getMyRSVPHandler)
				r.Group(func(r chi.Router) {
					r.Use(app.RSVPEnabledMiddleware)
					r.Post("/me/rsvp", app.submitMyRSVPHandler)
				})

				// Travel RSVP (proof of travel) mirrors the RSVP gating with its own toggle
				r.Get("/me/travel-rsvp", app.getMyTravelRSVPHandler)
				r.Get("/me/travel-rsvp/receipt-url", app.getMyTravelReceiptURLHandler)
				r.Group(func(r chi.Router) {
					r.Use(app.TravelRSVPEnabledMiddleware)
					r.Post("/me/travel-rsvp", app.submitMyTravelRSVPHandler)
					r.Post("/me/travel-rsvp/receipt-upload-url", app.generateTravelReceiptUploadURLHandler)
				})

				r.Group(func(r chi.Router) {
					r.Use(app.ApplicationsEnabledMiddleware)
					r.Patch("/me", app.updateApplicationHandler)
					r.Post("/me/submit", app.submitApplicationHandler)
					r.Post("/me/resume-upload-url", app.generateResumeUploadURLHandler)
					r.Delete("/me/resume", app.deleteResumeHandler)
				})
			})

			r.Group(func(r chi.Router) {
				r.Use(app.RequireRoleMiddleware(store.RoleAdmin))
				// Admin routes
				r.Route("/admin", func(r chi.Router) {

					// Applications
					r.Route("/applications", func(r chi.Router) {
						r.Get("/", app.listApplicationsHandler)
						r.Get("/stats", app.getApplicationStatsHandler)
						r.Get("/{applicationID}", app.getApplication)
						r.Get("/{applicationID}/resume-url", app.getResumeDownloadURLHandler)
						r.Get("/{applicationID}/travel-receipt-urls", app.getTravelReceiptURLsHandler)

						// Assigned Applications
						r.Get("/{applicationID}/notes", app.getApplicationNotes)
						r.Put("/{applicationID}/ai-percent", app.setAIPercent)
					})

					// Reviews
					r.Route("/reviews", func(r chi.Router) {
						r.Get("/pending", app.getPendingReviews)
						r.Get("/next", app.getNextReview)
						r.Put("/{reviewID}", app.submitVote)
						r.Get("/completed", app.getCompletedReviews)
					})

					// Scans
					r.Route("/scans", func(r chi.Router) {
						r.Post("/", app.createScanHandler)
						r.Get("/types", app.getScanTypesHandler)
						r.Get("/user/{userID}", app.getUserScansHandler)
						r.Get("/stats", app.getScanStatsHandler)
						r.Post("/rebalance-stats", app.rebalanceScanStatsHandler)
					})

					// Schedule
					r.Route("/schedule", func(r chi.Router) {
						r.Get("/", app.listScheduleHandler)
						r.Get("/date-range", app.getAdminScheduleDateRange)

						r.Group(func(r chi.Router) {
							r.Use(app.AdminScheduleEditPermissionMiddleware)
							r.Post("/", app.createScheduleHandler)
							r.Put("/{scheduleID}", app.updateScheduleHandler)
							r.Delete("/{scheduleID}", app.deleteScheduleHandler)
						})
					})

					// Sponsors
					r.Route("/sponsors", func(r chi.Router) {
						r.Get("/", app.listSponsorsHandler)

						r.Group(func(r chi.Router) {
							r.Use(app.AdminSponsorEditPermissionMiddleware)
							r.Post("/", app.createSponsorHandler)
							r.Put("/{sponsorID}", app.updateSponsorHandler)
							r.Delete("/{sponsorID}", app.deleteSponsorHandler)
							r.Put("/{sponsorID}/logo", app.uploadLogoHandler)
						})
					})

					// FAQ
					r.Route("/faq", func(r chi.Router) {
						r.Get("/", app.listFAQsHandler)
						r.Get("/edit-permission", app.getFAQEditPermissionHandler)

						r.Group(func(r chi.Router) {
							r.Use(app.AdminFAQEditPermissionMiddleware)
							r.Post("/", app.createFAQHandler)
							r.Put("/{faqID}", app.updateFAQHandler)
							r.Delete("/{faqID}", app.deleteFAQHandler)
						})
					})
				})
			})

			r.Group(func(r chi.Router) {
				r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin))
				// Super admin routes
				r.Route("/superadmin", func(r chi.Router) {
					r.Post("/reset-hackathon", app.resetHackathonHandler)
					r.Get("/forms/summary", app.getFormsOverview)

					// Hacker links
					r.Route("/hacker-links", func(r chi.Router) {
						r.Get("/", app.listHackerLinksHandler)
						r.Post("/", app.createHackerLinkHandler)
						r.Put("/{linkID}", app.updateHackerLinkHandler)
						r.Delete("/{linkID}", app.deleteHackerLinkHandler)
					})

					// Configs
					r.Route("/settings", func(r chi.Router) {
						r.Get("/schema-contract", app.getSchemaContract)
						r.Get("/application-schema", app.getApplicationSchema)
						r.Put("/application-schema", app.updateApplicationSchema)
						r.Get("/rsvp-schema", app.getRSVPSchema)
						r.Put("/rsvp-schema", app.updateRSVPSchema)
						r.Get("/rsvp-enabled", app.getRSVPEnabled)
						r.Put("/rsvp-enabled", app.setRSVPEnabled)
						r.Get("/travel-rsvp-schema", app.getTravelRSVPSchema)
						r.Put("/travel-rsvp-schema", app.updateTravelRSVPSchema)
						r.Get("/travel-rsvp-enabled", app.getTravelRSVPEnabled)
						r.Put("/travel-rsvp-enabled", app.setTravelRSVPEnabled)
						r.Get("/reviews-per-app", app.getReviewsPerApp)
						r.Post("/reviews-per-app", app.setReviewsPerApp)
						r.Put("/review-assignment-toggle", app.setReviewAssignmentToggle)
						r.Get("/admin-schedule-edit-toggle", app.getAdminScheduleEditToggle)
						r.Post("/admin-schedule-edit-toggle", app.setAdminScheduleEditToggle)
						r.Get("/admin-sponsor-edit-toggle", app.getAdminSponsorEditToggle)
						r.Post("/admin-sponsor-edit-toggle", app.setAdminSponsorEditToggle)
						r.Get("/admin-faq-edit-toggle", app.getAdminFAQEditToggle)
						r.Post("/admin-faq-edit-toggle", app.setAdminFAQEditToggle)
						r.Get("/hackathon-date-range", app.getHackathonDateRange)
						r.Post("/hackathon-date-range", app.setHackathonDateRange)
						r.Get("/hacker-pack-url", app.getHackerPackURL)
						r.Post("/hacker-pack-url", app.setHackerPackURL)
						r.Post("/points-name", app.setPointsName)
						r.Get("/points-enabled", app.getPointsEnabled)
						r.Post("/points-enabled", app.setPointsEnabled)
						r.Get("/hackathon-name", app.getHackathonName)
						r.Post("/hackathon-name", app.setHackathonName)
						r.Get("/contact-email", app.getContactEmail)
						r.Post("/contact-email", app.setContactEmail)
						r.Get("/from-email", app.getFromEmail)
						r.Post("/from-email", app.setFromEmail)
						r.Get("/from-name", app.getFromName)
						r.Post("/from-name", app.setFromName)
						r.Get("/application-due-date", app.getApplicationDueDate)
						r.Post("/application-due-date", app.setApplicationDueDate)
						r.Get("/privacy-policy-url", app.getPrivacyPolicyURL)
						r.Post("/privacy-policy-url", app.setPrivacyPolicyURL)
						r.Get("/terms-url", app.getTermsURL)
						r.Post("/terms-url", app.setTermsURL)
						r.Get("/onboarding-status", app.getOnboardingStatus)
						r.Put("/scan-types", app.updateScanTypesHandler)
						r.Get("/meal-groups", app.getMealGroups)
						r.Put("/meal-groups", app.updateMealGroups)
						r.Get("/meal-groups/stats", app.getMealGroupStats)
						r.Put("/applications-enabled", app.setApplicationsEnabled)
					})

					r.Route("/walk-ins", func(r chi.Router) {
						r.Get("/", app.getWalkInsHandler)
						r.Post("/promote", app.promoteWalkInsHandler)
					})

					r.Route("/applications", func(r chi.Router) {
						r.Post("/assign", app.batchAssignReviews)
						r.Get("/emails", app.getApplicantEmailsByStatusHandler)
						r.Patch("/{applicationID}/status", app.setApplicationStatus)
						r.Patch("/{applicationID}/travel-status", app.setApplicationTravelStatus)
						// Repair hatches for the one-shot hacker RSVPs
						r.Post("/{applicationID}/rsvp/reset", app.resetApplicationRSVPHandler)
						r.Post("/{applicationID}/travel-rsvp/reset", app.resetApplicationTravelRSVPHandler)
					})

					// Outbound decision emails
					r.Route("/emails", func(r chi.Router) {
						r.Get("/decisions/stats", app.getDecisionEmailStatsHandler)
						r.Post("/decisions", app.sendDecisionEmailsHandler)
					})

					// User Management
					r.Route("/users", func(r chi.Router) {
						r.Get("/", app.searchUsersHandler)
						r.Patch("/{userID}/role", app.updateUserRoleHandler)
						r.Delete("/{userID}", app.deleteUserHandler)
					})

					// Scheduled push notifications
					r.Route("/notifications", func(r chi.Router) {
						r.Get("/", app.listScheduledNotificationsHandler)
						r.Post("/", app.createScheduledNotificationHandler)
						r.Post("/from-schedule", app.generateScheduleNotificationsHandler)
						r.Patch("/{notificationID}", app.updateScheduledNotificationHandler)
						r.Delete("/{notificationID}", app.deleteScheduledNotificationHandler)
					})
				})
			})
		})
	})

	// frontend static files
	r.Handle("/*", app.spaHandler("./static"))

	return r
}

func (app *application) run(mux http.Handler) error {

	server := &http.Server{
		Addr:         app.config.addr,
		Handler:      mux,
		WriteTimeout: time.Second * 30,
		ReadTimeout:  time.Second * 10,
		IdleTimeout:  time.Minute,
	}

	// Graceful shutdown
	shutdown := make(chan error)

	go func() {
		quit := make(chan os.Signal, 1)

		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		s := <-quit

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		app.logger.Infow("server caught", "signal", s.String())

		if app.dispatcherCancel != nil {
			app.dispatcherCancel()
		}

		shutdown <- server.Shutdown(ctx)
	}()

	app.logger.Infow("server has started", "addr", app.config.addr, "env", app.config.env)

	err := server.ListenAndServe()
	if !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	err = <-shutdown
	if err != nil {
		return err
	}

	app.logger.Infow("server has stopped", "addr", app.config.addr, "env", app.config.env)

	return nil
}
