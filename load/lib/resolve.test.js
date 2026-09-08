// load/lib/resolve.test.js
// Unit tests for the pure resolution logic. Run with plain node (no k6, no
// framework):  `node lib/resolve.test.js`  (or `task load:test` / `npm test`).
import {
  pick,
  resolveBaseUrl,
  resolveScenario,
  resolveSessionsPath,
  parseSessions,
  resolveLoadPath,
} from "./resolve.js";

let passed = 0;

function fail(msg) {
  throw new Error(msg);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    fail(`${label}: expected ${e}, got ${a}`);
  }
}

function t(name, fn) {
  fn();
  passed++;
  console.log("ok  -", name);
}

// --- pick -----------------------------------------------------------------
t("pick: returns value when present", () =>
  assertEqual(pick({ k: "v" }, "k", "d"), "v", "pick present"));

t("pick: falls back when key missing", () =>
  assertEqual(pick({}, "k", "d"), "d", "pick missing"));

t("pick: empty string treated as unset", () =>
  assertEqual(pick({ k: "" }, "k", "d"), "d", "pick empty"));

// --- resolveBaseUrl -------------------------------------------------------
t("BASE_URL: explicit flag beats config", () =>
  assertEqual(
    resolveBaseUrl({ BASE_URL: "https://env.example" }, { baseUrl: "https://cfg.example" }),
    "https://env.example", "BASE_URL env-wins",
  ));

t("BASE_URL: config used when no flag", () =>
  assertEqual(resolveBaseUrl({}, { baseUrl: "https://cfg.example" }), "https://cfg.example", "BASE_URL config"));

t("BASE_URL: built-in default when neither", () =>
  assertEqual(resolveBaseUrl({}, {}), "https://your-portal.example.com", "BASE_URL default"));

t("BASE_URL: empty flag falls back to config", () =>
  assertEqual(resolveBaseUrl({ BASE_URL: "" }, { baseUrl: "https://cfg.example" }), "https://cfg.example", "BASE_URL empty->cfg"));

// --- resolveScenario ------------------------------------------------------
t("SCENARIO: explicit flag beats config", () =>
  assertEqual(resolveScenario({ SCENARIO: "stress.js" }, { scenario: "load.js" }), "stress.js", "SCENARIO env-wins"));

t("SCENARIO: config default", () =>
  assertEqual(resolveScenario({}, { scenario: "soak.js" }), "soak.js", "SCENARIO config"));

t("SCENARIO: final fallback is load.js", () =>
  assertEqual(resolveScenario({}, {}), "load.js", "SCENARIO default"));

// --- resolveSessionsPath --------------------------------------------------
t("SESSIONS_FILE: explicit flag beats config", () =>
  assertEqual(resolveSessionsPath({ SESSIONS_FILE: "real.json" }, { sessionsFile: "sessions.json" }), "real.json", "SESSIONS_FILE env-wins"));

t("SESSIONS_FILE: default file", () =>
  assertEqual(resolveSessionsPath({}, {}), "sessions.json", "SESSIONS_FILE default"));

// --- parseSessions --------------------------------------------------------
t("parseSessions: bare array (back-compat)", () =>
  assertDeepEqual(parseSessions('["a","b"]'), ["a", "b"], "bare array"));

t("parseSessions: merged { sessions: [...] }", () =>
  assertDeepEqual(parseSessions('{"baseUrl":"b","sessions":["x","y"]}'), ["x", "y"], "merged"));

t("parseSessions: malformed JSON => empty pool", () =>
  assertDeepEqual(parseSessions("not json"), [], "malformed"));

t("parseSessions: object without sessions => empty pool", () =>
  assertDeepEqual(parseSessions('{"baseUrl":"b"}'), [], "no sessions key"));

// --- resolveLoadPath -------------------------------------------------------
t("resolveLoadPath: anchors relative path at load root", () =>
  assertEqual(resolveLoadPath("sessions.json"), "../sessions.json", "rel root"));

t("resolveLoadPath: untouched absolute unix path", () =>
  assertEqual(resolveLoadPath("/data/sessions.json"), "/data/sessions.json", "abs unix"));

t("resolveLoadPath: untouched windows drive path", () =>
  assertEqual(resolveLoadPath("C:\\data\\sessions.json"), "C:\\data\\sessions.json", "abs win"));

t("resolveLoadPath: untouched UNC path", () =>
  assertEqual(resolveLoadPath("\\\\server\\share\\s.json"), "\\\\server\\share\\s.json", "abs unc"));

t("resolveLoadPath: undef => undef", () =>
  assertEqual(resolveLoadPath(""), "", "empty"));

console.log(`\n${passed} tests passed`);