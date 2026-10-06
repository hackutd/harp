#!/usr/bin/env bash
#
# Scrubs the hacker PII a Neon branch reset copies from prod into staging, so
# staging admins can be given super admin without seeing real hacker data.
#
# What it changes:
#   users                 every non-admin gets a fake email
#                         (hacker-<id>@example.invalid) and no profile picture.
#                         Admins and super admins keep their email so they can
#                         still sign in (staging relinks sign-ins by email).
#   applications          responses, rsvp_responses and travel_rsvp_responses
#                         are rewritten against the live form schemas: select,
#                         multi_select, checkbox and number answers are kept
#                         (so stats and filters still work), as are university,
#                         major and country_of_residence. Every other text,
#                         textarea and phone answer is replaced with a
#                         placeholder, and keys no schema knows are dropped.
#                         resume_path and travel_receipt_paths are cleared.
#   application_reviews   reviewer notes are replaced with a placeholder.
#   push_subscriptions    deleted (device endpoints).
#
# Votes, statuses, scans, walk-ins and timestamps are left alone.
#
# A reset brings the PII back, so run this after every
# `neon branches reset staging --parent`. Neon's history on the staging branch
# still holds the pre-scrub rows until its restore window passes.
#
# The connection string always comes from the STAGING_DB_ADDR secret, never
# from an argument or .env, so this can't be pointed at prod by mistake.
#
# Usage:
#   scripts/scrub-staging-pii.sh         # show what would change
#   scripts/scrub-staging-pii.sh --yes   # scrub
#
# Or through Taskfile: task scrub-staging-pii [-- --yes]
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
  (SELECT count(*) FROM users WHERE role = 'hacker'
     AND email NOT LIKE 'hacker-%@example.invalid') AS hackers_with_real_email,
  (SELECT count(*) FROM applications) AS applications,
  (SELECT count(*) FROM applications
     WHERE resume_path IS NOT NULL OR travel_receipt_paths <> '{}') AS applications_with_files,
  (SELECT count(*) FROM application_reviews
     WHERE notes IS NOT NULL AND notes <> '') AS review_notes,
  (SELECT count(*) FROM push_subscriptions) AS push_subscriptions;

SELECT email, role FROM users WHERE role <> 'hacker' ORDER BY role DESC, email;
SQL

if [[ "$apply" != true ]]; then
  echo "Nothing changed. The users above keep their email."
  echo "Re-run with --yes to scrub."
  exit 0
fi

run_sql <<'SQL'
BEGIN;

-- Rewrites one response object against the form schema stored under
-- schema_key. Keys absent from the schema are dropped.
CREATE FUNCTION pg_temp.scrub_responses(responses jsonb, schema_key text, app_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_object_agg(r.key,
    CASE
      WHEN f->>'type' IN ('select', 'multi_select', 'checkbox', 'number')
        OR r.key IN ('university', 'major', 'country_of_residence')
        OR r.value IN ('null'::jsonb, '""'::jsonb)
        THEN r.value
      WHEN r.key = 'first_name' THEN to_jsonb('Hacker'::text)
      WHEN r.key = 'last_name' THEN to_jsonb(left(app_id::text, 8))
      WHEN f->>'type' = 'phone' THEN to_jsonb('+15555550100'::text)
      ELSE to_jsonb('[redacted]'::text)
    END), '{}'::jsonb)
  FROM jsonb_each(responses) r
  JOIN settings s ON s.key = schema_key
  CROSS JOIN LATERAL jsonb_array_elements(s.value) f
  WHERE f->>'id' = r.key
$$;

WITH updated AS (
  UPDATE users
  SET email = 'hacker-' || id || '@example.invalid',
      profile_picture_url = NULL
  WHERE role = 'hacker'
  RETURNING 1
)
SELECT count(*) AS users_scrubbed FROM updated;

WITH updated AS (
  UPDATE applications
  SET responses = pg_temp.scrub_responses(responses, 'application_schema', id),
      rsvp_responses = pg_temp.scrub_responses(rsvp_responses, 'rsvp_schema', id),
      travel_rsvp_responses = pg_temp.scrub_responses(travel_rsvp_responses, 'travel_rsvp_schema', id),
      resume_path = NULL,
      travel_receipt_paths = '{}'
  RETURNING 1
)
SELECT count(*) AS applications_scrubbed FROM updated;

WITH updated AS (
  UPDATE application_reviews
  SET notes = '[redacted]'
  WHERE notes IS NOT NULL AND notes <> ''
  RETURNING 1
)
SELECT count(*) AS review_notes_scrubbed FROM updated;

WITH deleted AS (DELETE FROM push_subscriptions RETURNING 1)
SELECT count(*) AS push_subscriptions_deleted FROM deleted;

COMMIT;
SQL

echo "Done."
