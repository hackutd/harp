#!/usr/bin/env bash
# Short-command dispatcher for the k6 load suite.
#
# Reads baseUrl / scenario / sessionsFile from load/config.json (point CONFIG_FILE
# elsewhere to override) and runs k6 with them, so a daily run is just:
#
#     load/run.sh                 # runs whatever scenario config.json names
#     load/run.sh --vus 3000      # …with extra k6 flags appended
#     SCENARIO=stress.js load/run.sh   # override scenario for this invocation
#     BASE_URL=https://… load/run.sh   # point at a deploy without editing config
#
# Overrides: BASE_URL / SCENARIO / SESSIONS_FILE / CONFIG_FILE env vars beat the
# file (mirrors how `-e` flags already override __ENV inside the scenarios).
set -euo pipefail
cd "$(dirname "$0")"

CONFIG_FILE="${CONFIG_FILE:-config.json}"

# Read a string field from the flat JSON config. Prefer python3 if present; fall
# back to grep/sed (the config is a controlled flat shape); "" if missing.
json_get() {
  python3 -c "import json,sys;print(json.load(open('$CONFIG_FILE')).get('$1') or '')" 2>/dev/null \
    || grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$CONFIG_FILE" 2>/dev/null \
    | head -n1 | sed -E 's/^[^:]*:[[:space:]]*"//; s/"$//'
}

BASE_URL="${BASE_URL:-$(json_get baseUrl)}"
SCENARIO="${SCENARIO:-$(json_get scenario)}"
SESSIONS_FILE="${SESSIONS_FILE:-$(json_get sessionsFile)}"
SCENARIO="${SCENARIO:-load.js}"

printf 'load/run: scenario=%s baseUrl=%s sessions=%s\n' \
  "$SCENARIO" "${BASE_URL:-<unset>}" "${SESSIONS_FILE:-<unset>}"

K6_ARGS=(run)
[ -n "$BASE_URL" ]      && K6_ARGS+=(-e "BASE_URL=$BASE_URL")
[ -n "$SESSIONS_FILE" ] && K6_ARGS+=(-e "SESSIONS_FILE=$SESSIONS_FILE")
[ -n "$CONFIG_FILE" ]   && K6_ARGS+=(-e "CONFIG_FILE=$CONFIG_FILE")
K6_ARGS+=("scenarios/$SCENARIO" "$@")

# DRY_RUN=1 prints the resolved command instead of executing it (handy preview).
if [ "${DRY_RUN:-0}" = "1" ]; then
  printf 'k6 args: %s\n' "${K6_ARGS[*]}"
  exit 0
fi

exec docker compose -f ../docker-compose.load.yml run --rm k6 "${K6_ARGS[@]}"