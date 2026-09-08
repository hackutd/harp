// load/lib/sessions.js — support the (b) "pre-seeded real sessions" approach.
// Each scenario may point SESSIONS_FILE at a JSON array of session cookie payloads
// (one per VU, ordered to match VU ids), or set the file via load/config.json
// (`sessionsFile`). The resolved file may hold either the bare-array shape or the
// merged-config shape ({ "sessions": [ … ] }) — resolveSessionsPath/parseSessions
// (./resolve.js) handle both. Missing/unparseable pool => unauthenticated fallback.

import { SharedArray } from "k6/data";
import { resolveSessionsPath, parseSessions, resolveLoadPath } from "./resolve.js";
import { CONFIG } from "./helpers.js";

const SESSIONS_FILE_NAME = resolveSessionsPath(__ENV, CONFIG);
const SESSIONS_FILE_PATH = SESSIONS_FILE_NAME ? resolveLoadPath(SESSIONS_FILE_NAME) : "";

const sessions = SESSIONS_FILE_PATH
  ? (() => {
      const raw = open(SESSIONS_FILE_PATH); // resolved to the load/ root
      return new SharedArray("sessions", () => parseSessions(raw));
    })()
  : new SharedArray("sessions", () => []);

export function hasSessions() {
  return sessions.length > 0;
}

// Cookie header value for the current VU. VU ids start at 1; sharedArrayIndex is
// the actual index.
export function sessionCookie(VU) {
  if (!hasSessions()) {
    return "";
  }
  const i = (VU - 1) % sessions.length;
  return sessions[i] || "";
}