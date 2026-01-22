include .env
MIGRATIONS_PATH = ./cmd/migrate/migrations

.PHONY: migrate-create
migrate-create:
	@migrate create -seq -ext sql -dir $(MIGRATIONS_PATH) $(filter-out $@,$(MAKECMDGOALS))

.PHONY: migrate-up
migrate-up:
	@migrate -path=$(MIGRATIONS_PATH) -database=$(DB_ADDR) up

.PHONY: migrate-down
migrate-down:
	@migrate -path=$(MIGRATIONS_PATH) -database=$(DB_ADDR) down

.PHONY: migrate-force-0
migrate-force-0:
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_ADDR)" force 0

.PHONY: migrate-force-1
migrate-force-1:
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_ADDR)" force 1

.PHONY: seed
seed: 
	@go run cmd/migrate/seed/main.go

.PHONY: gen-docs
gen-docs:
	@swag init -d cmd/api,internal/store -g main.go -o docs --parseDependency && swag fmt
