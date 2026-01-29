package main

import (
	"context"
	"errors"
	"expvar"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/go-chi/cors"
	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/ratelimiter"
	"github.com/hackutd/portal/internal/store"
	"github.com/supertokens/supertokens-golang/supertokens"
	httpSwagger "github.com/swaggo/http-swagger"
	"go.uber.org/zap"
)

type application struct {
	config        config
	store         store.Storage
	logger        *zap.SugaredLogger
	mailer        mailer.Client
	rateLimiter   ratelimiter.Limiter
}

type config struct {
	addr        string
	db          dbConfig
	env         string
	apiURL      string
	frontendURL string
	mail        mailConfig
	auth        authConfig
	rateLimiter ratelimiter.Config
	supertokens supertokensConfig
}

type supertokensConfig struct {
	appName            string
	connectionURI      string
	apiKey             string
	apiBasePath        string
	googleClientID     string
	googleClientSecret string
}

type authConfig struct {
	basic basicConfig
	token tokenConfig
}

type tokenConfig struct {
	secret string
	exp    time.Duration
	iss    string
}

type basicConfig struct {
	user string
	pass string
}

type mailConfig struct {
	sendGrid  sendGridConfig
	fromEmail string
	exp       time.Duration
}

type sendGridConfig struct {
	apiKey string 
}

type dbConfig struct {
	addr string
	maxOpenConns int 
	maxIdleConns int 
	maxIdleTime string // TODO: LOOK INTO NOT USING A STRING FOR TIME
}

func (app *application) mount() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{app.config.frontendURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   append([]string{"Content-Type"}, supertokens.GetAllCORSHeaders()...),
		AllowCredentials: true,
	}))

	// SuperTokens middleware handles /auth/ routes automatically
	r.Use(supertokens.Middleware)

	// Ratelimiter
	if app.config.rateLimiter.Enabled {
		r.Use(app.RateLimiterMiddleware)
	}

	// auth endpoints not handled by SuperTokens
	r.Route("/auth", func(r chi.Router) {
		r.Get("/check-email", app.checkEmailAuthMethodHandler)
		r.With(app.AuthRequiredMiddleware).Get("/me", app.getCurrentUserHandler)
	})

	r.Route("/v1", func(r chi.Router) {
		// Public + basic auth
		r.With(app.BasicAuthMiddleware).Get("/health", app.healthCheckHandler)
		r.With(app.BasicAuthMiddleware).Get("/debug/vars", expvar.Handler().ServeHTTP)

		// Swagger docs
		docsURL := fmt.Sprintf("%s/swagger/doc.json", app.config.addr)
		r.With(app.BasicAuthMiddleware).Get("/swagger/*", httpSwagger.Handler(httpSwagger.URL(docsURL)))

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(app.AuthRequiredMiddleware)
			
			// Hacker Routes
			r.Route("/applications", func(r chi.Router) {
				r.Get("/me", app.getOrCreateApplicationHandler)
				r.Patch("/me", app.updateApplicationHandler)
				r.Post("/me/submit", app.submitApplicationHandler)
			})

			r.Group(func(r chi.Router) {
				r.Use(app.RequireRoleMiddleware(store.RoleAdmin))
				// Admin routes
				r.Route("/admin", func(r chi.Router) {
					r.Get("/applications", app.listApplicationsHandler)
					r.Get("/applications/stats", app.getApplicationStatsHandler)
					r.Get("/applications/{applicationID}", app.getApplication)
					r.Get("/applications/{applicationID}/reviews", app.getApplicationReviews)
					r.Get("/reviews/pending", app.getPendingReviews)
					r.Put("/reviews/{reviewID}", app.submitVote)
				})
			})

			r.Group(func(r chi.Router) {
				r.Use(app.RequireRoleMiddleware(store.RoleSuperAdmin))
				// Super admin routes
				r.Route("/superadmin", func(r chi.Router) {
					r.Get("/settings/saquestions", app.getShortAnswerQuestions)
					r.Put("/settings/saquestions", app.updateShortAnswerQuestions)
					r.Get("/settings/reviews-per-app", app.getReviewsPerApp)
					r.Post("/settings/reviews-per-app", app.setReviewsPerApp)
				})
			})
		})
	})

	return r
}

func (app *application) run(mux http.Handler) error {
	
	server := &http.Server{
		Addr: app.config.addr,
		Handler: mux,
		WriteTimeout: time.Second * 30,
		ReadTimeout: time.Second * 10,
		IdleTimeout: time.Minute,
	}

	// Graceful shutdown 
	shutdown := make(chan error)

	go func () {
		quit := make(chan os.Signal, 1)

		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		s := <-quit

		ctx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
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
