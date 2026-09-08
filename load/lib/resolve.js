// load/lib/resolve.js
// Pure config + session resolution: NO k6 globals (no __ENV, no open()), so this
// file can be unit-tested with plain `node` (see resolve.test.js). The k6-facing
// glue in helpers.js / sessions.js feeds __ENV and the parsed config through these.
//
// Precedence everywhere is: explicit flag/env > config file > built-in default.
// That is what lets ONE short command (load/run.sh / `task load:run`) run clean,
// while an explicit `-e BASE_URL=…` still beats the file for a one-off deploy.

// Return `map[key]` when present and non-empty, else `fallback`.
export function pick(map, key, fallback) {
  if (map && map[key] !== undefined && map[key] !== null && map[key] !== "") {
    return map[key];
  }
  return fallback;
}

export function resolveBaseUrl(envMap, config, fallback) {
  return pick(
    envMap, "BASE_URL",
    (config && config.baseUrl) || fallback || "https://your-portal.example.com",
  );
}

export function resolveScenario(envMap, config, fallback) {
  return pick(envMap, "SCENARIO", (config && config.scenario) || fallback || "load.js");
}

export function resolveSessionsPath(envMap, config, fallback) {
  return pick(
    envMap, "SESSIONS_FILE",
    (config && config.sessionsFile) || fallback || "sessions.json",
  );
}

// Parse a session-file payload into an array of cookie strings. Accepts either the
// bare-array shape (back-compat: sessions.json used to be a JSON array) or the
// merged-config shape ({ "sessions": [ … ] }). Anything unparseable -> empty pool.
export function parseSessions(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.sessions)) {
    return data.sessions;
  }
  return [];
}

// k6's open() resolves a relative path against the DIRECTORY OF THE FILE CALLING
// it, so a value like "sessions.json" read from lib/helpers.js or lib/sessions.js
// would point at lib/sessions.json (doesn't exist) instead of the load/ root.
// These lib files live exactly one level under load/, so prefix relative paths with
// "../" to anchor them at the load/ root where config.json / sessions.json live.
// Absolute paths (Unix /…, Windows C:\, UNC) pass through untouched.
export function resolveLoadPath(p) {
  if (!p) {
    return p;
  }
  if (p.startsWith("/") || p.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(p)) {
    return p;
  }
  return "../" + p;
}