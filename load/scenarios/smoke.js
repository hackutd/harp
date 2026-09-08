// load/scenarios/smoke.js
// 1-VU sanity pass: confirms the portal serves its shell and the authenticated
// API answers before any real run. Use with a fresh SESSIONS_FILE if you want an
// authed pass; otherwise it exercises public/static + the health probe..

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, jitter } from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

export const options = {
  scenarios: {
    smoke: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true,
      delayAbortEval: "10s" }],
    http_req_duration: [{ threshold: "p(95)<2000", abortOnFail: true,
      delayAbortEval: "10s" }],
  },
};

export function setup() {
  console.log("smoke: exercising", BASE_URL);
  return {};
}

export default function () {
  const cookie = sessionCookie(__VU);
  const headers = cookie ? { "cookie": cookie } : {};

  // Static SPA shell (served from / on Cloud Run).
  const shell = http.get(BASE_URL + "/", { headers });
  check(shell, {
    "portal shell is 200 or 304": (r) => [200,304].includes(r.status),
    "portal shell returns html": (r) => (r.body || "").indexOf("<div") >= 0,
  });

  // Authenticated session self-check (if we have sessions).
  if (hasSessions()) {
    const me = http.get(BASE_URL + "/v1/auth/me", { headers });
    check(me, {
      "auth/me is 200": (r) => r.status === 200,
    });
  }

  // Infra health probe (Basic Auth) — only when creds are provided.
  const hu = __ENV && __ENV.AUTH_BASIC_USER;
  const hp = __ENV && __ENV.AUTH_BASIC_PASS;
  if (hu && hp) {
    const hs = http.get(BASE_URL + "/v1/health", {
      headers: {
        authorization:
          "Basic " + __ENV.AUTH_BASIC_USER + ":" + __ENV.AUTH_BASIC_PASS,
      },
    });
    check(hs, { "health is 200 or 503": (r) => [200,503].includes(r.status) });
  }

 sleep(jitter(50, 250));
}