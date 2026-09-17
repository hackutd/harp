// load/lib/helpers.js
// Shared config / jitter / rate facts for every scenario. BASE_URL, SCENARIO and
// SESSIONS_FILE now resolve from load/config.json (point CONFIG_FILE elsewhere to
// override), with explicit `-e KEY=value` flags taking precedence — so the common
// run needs no flags at all (use load/run.sh or `task load:run`). The resolution
// + parsing logic lives in ./resolve.js, kept free of k6 globals so it can be
// unit-tested with plain `node` (lib/resolve.test.js).

import {
  pick,
  resolveBaseUrl,
  resolveScenario,
  resolveSessionsPath,
  resolveLoadPath,
} from "./resolve.js";

export function env(key, fallback) {
  return pick(__ENV, key, fallback);
}

function readJson(path) {
  try {
    return JSON.parse(open(path)); // open() is a k6 global
  } catch (e) {
    return {};
  }
}

const _configPath = env("CONFIG_FILE", "config.json");
export const CONFIG = _configPath ? readJson(resolveLoadPath(_configPath)) : {};

// Effective values: explicit flag > config file > built-in default.
export const BASE_URL = resolveBaseUrl(__ENV, CONFIG);
export const SCENARIO = resolveScenario(__ENV, CONFIG);
export const SESSIONS_FILE = resolveSessionsPath(__ENV, CONFIG);

// Rate limiter facts for this deploy (see .env.example / cmd/api/main.go).
export const WINDOW_SECONDS = envInt("RATE_WINDOW", 5);
export const USER_PER_WINDOW = envInt("RATE_PER_USER", 20);   // per signed-in user
export const IP_PER_WINDOW = envInt("RATE_PER_IP", 200);    // per IP (sessionless)

export function envInt(key, fallback) {
  return parseInt(env(key, String(fallback)), 10);
}

export function userRps() {
  return (USER_PER_WINDOW / WINDOW_SECONDS) * 0.9;
}

export function jitter(minMs, maxMs) {
  return (Math.random() * (maxMs - minMs) + minMs) / 1000; // k6 sleep() uses seconds
}