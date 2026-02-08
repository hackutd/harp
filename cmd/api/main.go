package main

import (
	"expvar"
	"log"
	"runtime"
	"time"

	_ "github.com/hackutd/portal/docs"
	"github.com/hackutd/portal/internal/auth"
	"github.com/hackutd/portal/internal/db"
	"github.com/hackutd/portal/internal/env"
	"github.com/hackutd/portal/internal/mailer"
	"github.com/hackutd/portal/internal/ratelimiter"
	"github.com/hackutd/portal/internal/store"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

const version = "0.0.0" // semver

//	@title						HackPortal API
//	@version					1.0
//	@description				API for HackPortal
//	@termsOfService				http://swagger.io/terms/
//	@contact.name				API Support
//	@contact.url				http://www.swagger.io/support
//	@contact.email				support@swagger.io
//	@license.name				Apache 2.0
//	@license.url				http://www.apache.org/licenses/LICENSE-2.0.html
//	@BasePath					/v1
//	@securityDefinitions.apikey	CookieAuth
//	@in							cookie
//	@name						sAccessToken
func main() {

	// Load env
	err := godotenv.Load(".env");
	if err != nil{
		log.Println(err)
	}
	
	// Init configs
	cfg := config{
		addr:   env.GetString("ADDR", ":8080"),
		apiURL: env.GetString("EXTERNAL_URL", "localhost:8080"), // <- for swagger
		db: dbConfig{
			addr:         env.GetRequiredString("DB_ADDR"),
			maxOpenConns: env.GetInt("DB_MAX_OPEN_CONNS", 30),
			maxIdleConns: env.GetInt("DB_MAX_IDLE_CONNS", 30),
			maxIdleTime:  env.GetString("DB_MAX_IDLE_TIME", "15m"),
		},
		env: env.GetString("ENV", "development"),
		mail: mailConfig{
			sendGrid: sendGridConfig{
				apiKey: env.GetRequiredString("SENDGRID_API_KEY"),
			},
			fromEmail: env.GetString("MAIL_FROM", "noreply@hackportal.com"),
		},
		auth: authConfig{
			basic: basicConfig{
				user: env.GetRequiredString("AUTH_BASIC_USER"),
				pass: env.GetRequiredString("AUTH_BASIC_PASS"),
			},
		},
		rateLimiter: ratelimiter.Config{
			// Limit 20 requests every 5 seconds per IP
			RequestPerTimeFrame: env.GetInt("RATELIMITER_REQUESTS_COUNT", 20),
			TimeFrame:           time.Second * 5,
			Enabled:             env.GetBool("RATE_LIMITER_ENABLED", true),
		},
		frontendURL: env.GetString("FRONTEND_URL", "http://localhost:3000"),
		supertokens: supertokensConfig{
			appName:            env.GetString("APP_NAME", "HackUTD Portal"),
			connectionURI:      env.GetRequiredString("SUPERTOKENS_CONNECTION_URI"),
			apiKey:             env.GetRequiredString("SUPERTOKENS_API_KEY"),
			apiBasePath:        env.GetString("SUPERTOKENS_API_BASE_PATH", "/auth"),
			googleClientID:     env.GetString("GOOGLE_CLIENT_ID", ""),
			googleClientSecret: env.GetString("GOOGLE_CLIENT_SECRET", ""),
		},
	}

	// Init Logger
	logger := zap.Must(zap.NewProduction()).Sugar()
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
		APIBasePath:        cfg.supertokens.apiBasePath,
		APIURL:             cfg.apiURL,
		FrontendURL:        cfg.frontendURL,
		GoogleClientID:     cfg.supertokens.googleClientID,
		GoogleClientSecret: cfg.supertokens.googleClientSecret,
	}
	if err := auth.InitSuperTokens(authCfg, store); err != nil {
		logger.Fatal("failed to initialize supertokens", zap.Error(err))
	}
	logger.Info("supertokens initialized")

	// Init mailer
	mailClient := mailer.NewSendGrid(cfg.mail.sendGrid.apiKey, cfg.mail.fromEmail)

	// Init rate limiter
	rateLimiter := ratelimiter.NewFixedWindowLimiter(
		cfg.rateLimiter.RequestPerTimeFrame,
		cfg.rateLimiter.TimeFrame,
	)

	// Init app
	app := &application{
		config:      cfg,
		store:       store,
		logger:      logger,
		mailer:      mailClient,
		rateLimiter: rateLimiter,
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

	log.Fatal(app.run(mux))
}
