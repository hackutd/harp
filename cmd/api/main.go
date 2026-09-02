package main

import (
	"context"
	"expvar"
	"log"
	"runtime"
	"time"

	_ "github.com/hackutd/harp/docs"
	"github.com/hackutd/harp/internal/auth"
	"github.com/hackutd/harp/internal/db"
	"github.com/hackutd/harp/internal/env"
	"github.com/hackutd/harp/internal/gcs"
	"github.com/hackutd/harp/internal/logger"
	"github.com/hackutd/harp/internal/mailer"
	"github.com/hackutd/harp/internal/ratelimiter"
	"github.com/hackutd/harp/internal/store"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

var version = "dev"

// @title						Harp API
// @version					1.0
// @description				API for Harp, the hackathon applications and review platform
// @contact.name				Harp maintainers
// @contact.url				https://github.com/hackutd/harp/issues
// @license.name				MIT
// @license.url				https://github.com/hackutd/harp/blob/main/LICENSE
// @BasePath					/v1
// @securityDefinitions.apikey	CookieAuth
// @in							cookie
// @name						sAccessToken
func main() {

	// Load env
	err := godotenv.Load(".env")
	if err != nil {
		log.Println(err)
	}

	// Init configs
	appURL := env.GetString("APP_URL", "http://localhost:8080")
	frontendURL := env.GetString("FRONTEND_URL", appURL)

	// Wallet passes carry the organizer's name, so fall back through
	// HACKATHON_NAME rather than making every deployment set a second variable
	// with the same answer. These cannot default to "": applewallet.New rejects
	// an empty organization name or description, which would turn
	// APPLE_WALLET_ENABLED=true into a boot failure.
	walletOrganizationName := env.GetString("APPLE_WALLET_ORGANIZATION_NAME",
		env.GetString("HACKATHON_NAME", mailer.DefaultHackathonName))

	cfg := config{
		addr:   env.GetString("ADDR", ":8080"),
		appURL: appURL,
		db: dbConfig{
			addr:         env.GetString("DB_ADDR", "postgres://admin:adminpassword@localhost:5432/portal?sslmode=disable"),
			maxOpenConns: env.GetInt("DB_MAX_OPEN_CONNS", 30),
			maxIdleConns: env.GetInt("DB_MAX_IDLE_CONNS", 30),
			maxIdleTime:  env.GetString("DB_MAX_IDLE_TIME", "15m"),
		},
		env: env.GetString("ENV", "development"),
		mail: mailer.Config{
			SendGrid: mailer.SendGridConfig{
				APIKey: env.GetString("SENDGRID_API_KEY", ""),
			},
			SMTP: mailer.SMTPConfig{
				Host:     env.GetString("EMAIL_HOST", ""),
				Port:     env.GetInt("EMAIL_PORT", 587),
				Username: env.GetString("EMAIL_USERNAME", ""),
				Password: env.GetString("EMAIL_PASSWORD", ""),
			},
			FromEmail:     env.GetString("EMAIL_FROM", "noreply@example.com"),
			FromName:      env.GetString("EMAIL_FROM_NAME", env.GetString("HACKATHON_NAME", mailer.DefaultHackathonName)),
			HackathonName: env.GetString("HACKATHON_NAME", mailer.DefaultHackathonName),
			PortalURL:     frontendURL,
		},
		gcs: gcsConfig{
			bucketName: env.GetString("GCS_BUCKET_NAME", ""),
		},
		auth: authConfig{
			basic: basicConfig{
				user: env.GetRequiredString("AUTH_BASIC_USER"),
				pass: env.GetRequiredString("AUTH_BASIC_PASS"),
			},
			publicAPIKey: env.GetString("PUBLIC_API_KEY", ""),
		},
		rateLimiter: ratelimiter.Config{
			// Limit 20 requests every 5 seconds per signed-in user. Requests
			// without a verified session fall back to a per-IP bucket with a
			// larger budget, since a whole venue can sit behind one NAT.
			RequestPerTimeFrame:   env.GetInt("RATELIMITER_REQUESTS_COUNT", 20),
			IPRequestPerTimeFrame: env.GetInt("RATELIMITER_IP_REQUESTS_COUNT", 200),
			TimeFrame:             time.Second * 5,
			Enabled:               env.GetBool("RATE_LIMITER_ENABLED", true),
		},
		frontendURL:      frontendURL,
		publicCORSOrigin: env.GetString("PUBLIC_CORS_ORIGIN", ""),
		supertokens: supertokensConfig{
			appName:            env.GetString("APP_NAME", "Harp Portal"),
			connectionURI:      env.GetRequiredString("SUPERTOKENS_CONNECTION_URI"),
			apiKey:             env.GetRequiredString("SUPERTOKENS_API_KEY"),
			googleClientID:     env.GetString("GOOGLE_CLIENT_ID", ""),
			googleClientSecret: env.GetString("GOOGLE_CLIENT_SECRET", ""),
		},
		vapid: vapidConfig{
			publicKey:  env.GetString("VAPID_PUBLIC_KEY", ""),
			privateKey: env.GetString("VAPID_PRIVATE_KEY", ""),
			subject:    env.GetString("VAPID_SUBJECT", "noreply@example.com"),
		},
		appleWallet: appleWalletConfig{
			enabled:               env.GetBool("APPLE_WALLET_ENABLED", false),
			passTypeIdentifier:    env.GetString("APPLE_WALLET_PASS_TYPE_IDENTIFIER", ""),
			teamIdentifier:        env.GetString("APPLE_WALLET_TEAM_IDENTIFIER", ""),
			organizationName:      walletOrganizationName,
			description:           env.GetString("APPLE_WALLET_DESCRIPTION", walletOrganizationName+" Hacker Pass"),
			certificateBase64:     env.GetString("APPLE_WALLET_CERTIFICATE_BASE64", ""),
			privateKeyBase64:      env.GetString("APPLE_WALLET_PRIVATE_KEY_BASE64", ""),
			wwdrCertificateBase64: env.GetString("APPLE_WALLET_WWDR_CERTIFICATE_BASE64", ""),
			iconPath:              env.GetString("APPLE_WALLET_ICON_PATH", "client/portal/public/pwa-192x192.png"),
		},
	}

	// Init Logger
	logger := logger.New(cfg.env)
	defer logger.Sync()

	// Init Database
	db, err := db.New(
		cfg.db.addr,
		cfg.db.maxOpenConns,
		cfg.db.maxIdleConns,
		cfg.db.maxIdleTime,
	)
	if err != nil {
		logger.Fatal(err)
	}

	defer db.Close()

	logger.Info("db connection established")

	store := store.NewStorage(db)

	// Initialize SuperTokens
	authCfg := auth.Config{
		AppName:            cfg.supertokens.appName,
		ConnectionURI:      cfg.supertokens.connectionURI,
		APIKey:             cfg.supertokens.apiKey,
		APIBasePath:        "/auth",
		APIURL:             cfg.appURL,
		FrontendURL:        cfg.frontendURL,
		GoogleClientID:     cfg.supertokens.googleClientID,
		GoogleClientSecret: cfg.supertokens.googleClientSecret,
	}
	if err := auth.InitSuperTokens(authCfg, store); err != nil {
		logger.Fatal("failed to initialize supertokens", zap.Error(err))
	}
	logger.Info("supertokens initialized")

	// Init mailer — picks provider from .env SMTP or SendGrid, at least one is required
	mailClient, err := mailer.New(cfg.mail)
	if err != nil {
		logger.Fatal("failed to initialize mailer", zap.Error(err))
	}

	// Settings configured through the SuperAdmin onboarding form win over the
	// env defaults above, so renaming the event never needs a redeploy.
	mailClient.SetIdentityResolver(func() mailer.Identity {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		name, err := store.Settings.GetHackathonName(ctx)
		if err != nil {
			logger.Warnw("failed to read hackathon name setting", "error", err)
		}
		fromEmail, err := store.Settings.GetFromEmail(ctx)
		if err != nil {
			logger.Warnw("failed to read from email setting", "error", err)
		}
		fromName, err := store.Settings.GetFromName(ctx)
		if err != nil {
			logger.Warnw("failed to read from name setting", "error", err)
		}

		return mailer.Identity{HackathonName: name, FromEmail: fromEmail, FromName: fromName}
	})

	// Init GCS (optional in local/dev)
	var gcsClient gcs.Client
	if cfg.gcs.bucketName != "" {
		gc, err := gcs.New(context.Background(), cfg.gcs.bucketName)
		if err != nil {
			logger.Fatal("failed to initialize gcs client", zap.Error(err))
		}
		defer gc.Close()

		gcsClient = gc
		logger.Infow("gcs client initialized", "bucket", cfg.gcs.bucketName)
	}

	// Init rate limiters
	rateLimiter := ratelimiter.NewFixedWindowLimiter(
		cfg.rateLimiter.RequestPerTimeFrame,
		cfg.rateLimiter.TimeFrame,
	)
	ipRateLimiter := ratelimiter.NewFixedWindowLimiter(
		cfg.rateLimiter.IPRequestPerTimeFrame,
		cfg.rateLimiter.TimeFrame,
	)

	// Apple Wallet signing is optional. If explicitly enabled, invalid or
	// incomplete signing material is a deployment error.
	appleWalletPasses, err := newAppleWalletPassGenerator(cfg.appleWallet)
	if err != nil {
		logger.Fatal(err)
	}
	if appleWalletPasses != nil {
		logger.Info("Apple Wallet pass generation enabled")
	}

	// Init app
	app := &application{
		config:            cfg,
		store:             store,
		logger:            logger,
		mailer:            mailClient,
		gcsClient:         gcsClient,
		appleWalletPasses: appleWalletPasses,
		rateLimiter:       rateLimiter,
		ipRateLimiter:     ipRateLimiter,
		sessionUserID:     supertokensSessionUserID,
	}

	// Metrics collected
	expvar.NewString("version").Set(version)
	expvar.Publish("database", expvar.Func(func() any {
		return db.Stats()
	}))
	expvar.Publish("goroutines", expvar.Func(func() any {
		return runtime.NumGoroutine()
	}))

	mux := app.mount()

	dispatcherCtx, cancelDispatcher := context.WithCancel(context.Background())
	app.dispatcherCancel = cancelDispatcher
	go app.runNotificationDispatcher(dispatcherCtx)

	log.Fatal(app.run(mux))
}
