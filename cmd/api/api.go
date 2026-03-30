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
	"github.com/hackutd/portal/internal/gcs"
	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/ratelimiter"
	"github.com/hackutd/portal/internal/store"
	"github.com/supertokens/supertokens-golang/supertokens"
	httpSwagger "github.com/swaggo/http-swagger"
	"go.uber.org/zap"
)

type application struct {
	config      config
	store       store.Storage
	logger      *zap.SugaredLogger
	mailer      mailer.Client
	gcsClient   gcs.Client
	rateLimiter ratelimiter.Limiter
}

type config struct {
	addr              string
	db                dbConfig
	env               string
	appURL            string
	frontendURL       string
	hackathonTimeZone string
	mail              mailConfig
	gcs               gcsConfig
	auth              authConfig
	rateLimiter       ratelimiter.Config
	supertokens       supertokensConfig
	publicCORSOrigin  string
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

type mailConfig struct {
	sendGrid  sendGridConfig
	fromEmail string
}

type sendGridConfig struct {
	apiKey string
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
		"superadmin/applications",
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

	// Ratelimiter
	if app.config.rateLimiter.Enabled {
		r.Use(app.RateLimiterMiddleware)
	}

	r.Route("/v1", func(r chi.Router) {
		// Public API (key auth)
		r.Route("/public", func(r chi.Router) {
			r.Use(app.APIKeyMiddleware)
			r.Get("/schedule", app.getPublicScheduleHandler)
			r.Get("/sponsors", app.getPublicSponsorsHandler)
		})

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

			// Hacker Routes
			r.Route("/applications", func(r chi.Router) {
				r.Get("/me", app.getOrCreateApplicationHandler)
				r.Patch("/me", app.updateApplicationHandler)
				r.Post("/me/submit", app.submitApplicationHandler)
				r.Post("/me/resume-upload-url", app.generateResumeUploadURLHandler)
				r.Delete("/me/resume", app.deleteResumeHandler)
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

						// TODO: Protect Under a AdminSponsorEditPermissionMiddleware
						r.Post("/", app.createSponsorHandler)
						r.Put("/{sponsorID}", app.updateSponsorHandler)
						r.Delete("/{sponsorID}", app.deleteSponsorHandler)
						r.Put("/{sponsorID}/logo", app.uploadLogoHandler)
					})
				})
			})

			r.Group(func(r chi.Router) {
				r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin))
				// Super admin routes
				r.Route("/superadmin", func(r chi.Router) {

					// Configs
					r.Route("/settings", func(r chi.Router) {
						r.Get("/saquestions", app.getShortAnswerQuestions)
						r.Put("/saquestions", app.updateShortAnswerQuestions)
						r.Get("/reviews-per-app", app.getReviewsPerApp)
						r.Post("/reviews-per-app", app.setReviewsPerApp)
						r.Put("/review-assignment-toggle", app.setReviewAssignmentToggle)
						r.Get("/admin-schedule-edit-toggle", app.getAdminScheduleEditToggle)
						r.Post("/admin-schedule-edit-toggle", app.setAdminScheduleEditToggle)
						r.Get("/hackathon-date-range", app.getHackathonDateRange)
						r.Post("/hackathon-date-range", app.setHackathonDateRange)
						r.Put("/scan-types", app.updateScanTypesHandler)
					})

					r.Route("/applications", func(r chi.Router) {
						r.Post("/assign", app.batchAssignReviews)
						r.Get("/emails", app.getApplicantEmailsByStatusHandler)
						r.Patch("/{applicationID}/status", app.setApplicationStatus)
					})

					// User Management
					r.Route("/users", func(r chi.Router) {
						r.Get("/", app.searchUsersHandler)
						r.Patch("/{userID}/role", app.updateUserRoleHandler)
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
