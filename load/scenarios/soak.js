// load/scenarios/soak.js
// Sustained soak to catch leaks:/connection-pool exhaustion:/slow drift.
// Default: 30 minutes at a steady ~300 VU (overridable). Runs the read-mostly
// hacker surface. Use with a SESSIONS_FILE for the authed path.,

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, jitter } from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

export const options = {
  scenarios: {
    soak: {
      executor: "constant-vus",
      vus: 300,
      duration: "30m",
    },
  },
  thresholds: {
    http_req_failed:[{ threshold: "rate<0.005", abortOnFail: true, delayAbortEval: "30s" }],
    http_req_duration:[{ threshold: "p(95)<1500", abortOnFail: true, delayAbortEval: "30s" }],
  },
};

export default function () {
  const cookie = sessionCookie(__VU);
  const headers = cookie ? { "cookie": cookie } : {};
  const authed = hasSessions();

  const path = authed
    ? "/v1/applications/me"
    : "/v1/points-config";
  const res = http.get(BASE_URL + path, { headers });
  check(res, {
    "status is 200":(r) => r.status === 200,
    "returns data envelope":(r) => (r.body || "").indexOf("data") >= 0,
  });

  // A little variance keeps the pattern from lining up per-IP in the no-session case..
  sleep(jitter(200, 700));
}