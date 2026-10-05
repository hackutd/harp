#!/usr/bin/env bash
#
# Clears the push data a Neon branch reset copies from prod into staging:
# every push subscription, and every scheduled notification that hasn't been
# sent or failed yet.
#
# Those rows are harmless (staging signs pushes with its own VAPID keys, so
# every send is rejected), but the dispatcher keeps retrying them and logs
# "all push sends failed VAPID auth" on each sweep. Run this after
# `neon branches reset staging --parent` to stop that noise.
#
# The connection string always comes from the STAGING_DB_ADDR secret, never
# from an argument or .env, so this can't be pointed at prod by mistake.
#
# Usage:
#   scripts/clear-staging-push.sh         # show what would be deleted
#   scripts/clear-staging-push.sh --yes   # delete it
#
# Needs gcloud (logged in to harp-489116) and either psql or Docker.

set -euo pipefail

project=harp-489116
secret=STAGING_DB_ADDR

apply=false
case "${1:-}" in
  "") ;;
  --yes) apply=true ;;
  *)
    echo "usage: $0 [--yes]" >&2
    exit 2
    ;;
esac

if ! command -v gcloud >/dev/null; then
  echo "ERROR: gcloud is required to read $secret" >&2
  exit 1
fi

DB_URL=$(gcloud secrets versions access latest --secret="$secret" --project="$project")
export DB_URL
host=$(sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#' <<<"$DB_URL")

# Runs SQL from stdin against staging.
run_sql() {
  if command -v psql >/dev/null; then
    psql "$DB_URL" -X -q -v ON_ERROR_STOP=1
  elif command -v docker >/dev/null; then
    # DB_URL is passed by name so the password isn't on docker's command line.
    docker run --rm -i -e DB_URL postgres:16-alpine \
      sh -c 'exec psql "$DB_URL" -X -q -v ON_ERROR_STOP=1'
  else
    echo "ERROR: install psql (brew install libpq) or Docker" >&2
    exit 1
  fi
}

echo "Staging database: $host (from secret $secret)"
echo

run_sql <<'SQL'
SELECT
  (SELECT count(*) FROM push_subscriptions) AS push_subscriptions,
  (SELECT count(*) FROM scheduled_notifications
     WHERE sent_at IS NULL AND failed_at IS NULL) AS pending_notifications;
SQL

if [[ "$apply" != true ]]; then
  echo "Nothing deleted. Re-run with --yes to delete these rows."
  exit 0
fi

run_sql <<'SQL'
BEGIN;

WITH deleted AS (DELETE FROM push_subscriptions RETURNING 1)
SELECT count(*) AS push_subscriptions_deleted FROM deleted;

WITH deleted AS (
  DELETE FROM scheduled_notifications
  WHERE sent_at IS NULL AND failed_at IS NULL
  RETURNING 1
)
SELECT count(*) AS pending_notifications_deleted FROM deleted;

COMMIT;
SQL

echo "Done."
