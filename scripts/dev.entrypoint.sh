#!/bin/sh
set -e

echo "Running migrations..."
migrate -path="./cmd/migrate/migrations" -database="$DB_ADDR" up
echo "Migrations done."

exec air
