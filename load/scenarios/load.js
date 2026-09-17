// load/scenarios/load.js
// Expected day-of load: ~1,500 concurrent hackers (overridable with --vus),
// plus an opt-in reviewer/admin lane (set ADMIN_LANE=1 with an admin-role session
// pool). Respects the per-user rate budget whena session pool (SESSIONS_FILE) is
// provided; otherwise falls back to public/static reads (IP-bound — see README.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import {
  BASE_URL, env, jitter, USER_PER_WINDOW, WINDOW_SECONDS, IP_PER_WINDOW,
} from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

const adminLane = !!env("ADMIN_LANE", "");
const adminPool = adminLane && hasSessions();

// Sessionless (no SESSIONS_FILE) => every VU shares one client IP, so any multi-VU
// run floods the per-IP fixed-window limiter with 429s. That is expected behaviour,
// not an outage: we relax the 4xx failure threshold and surface the status-code
// spread below so you can tell 429s (rate limiter) from 5xx (real infra failure).
const ipLimited = !hasSessions();
// Operator-override acknowledging we deliberately want the shared-per-IP run to
// complete as a capacity sanity check (see the fail-fast guard in setup()).
const forceIPMode = !!env("FORCE_IP_MODE", "");
// Fail-fast guard trigger: abort a sessionless ramp that exceeds this many VUs.
const IP_WARN_VU = parseInt(env("IP_WARN_VU", "200"), 10) || 200;

const apiErrs = new Counter("api_errors");
const statusCodes = new Counter("http_status_codes");
const infraErrors = new Rate("http_5xx_rate");

export const options = {
  scenarios: {
    hackers: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 1500 },
        { duration: "3m", target: 1500 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
    ...(adminPool
      ? {
          reviewers: {
            executor: "constant-vus",
            vus: 5,
            duration: "7m",
            exec: "reviewer",
          },
        }
      : {}),
  },
  thresholds: {
    // 5xx is always a hard infra failure regardless of session mode; abort fast.
    http_5xx_rate: [{ threshold: "rate<0.01", abortOnFail: true,
      delayAbortEval: "15s" }],
    // Sessionless (IP-limited): 4xx/429 is the expected limiter signal, so count it
    // instead of aborting. Authed: the per-user budget applies, so any 4xx storm is a
    // genuine error and we keep the strict, aborting threshold.
    http_req_failed: ipLimited
      ? [{ threshold: "rate<0.50", abortOnFail: false, delayAbortEval: "15s" }]
      : [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "15s" }],
    http_req_duration: [
      { threshold: "p(95)<1500", abortOnFail: true, delayAbortEval: "15s" },
      { threshold: "p(99)<3000", abortOnFail: true, delayAbortEval: "15s" },
    ],
  },
};

export function setup() {
  const maxVUs = options.scenarios.hackers.stages.reduce(
    (m, s) => Math.max(m, s.target), 0,
  );
  if (ipLimited && !forceIPMode && maxVUs > IP_WARN_VU) {
    const bar = "=".repeat(72);
    console.log(
      [
        "",
        bar,
        "FAIL-FAST GUARD: sessionless run (no SESSIONS_FILE) at too-high VU scale",
        bar,
        `ALL ${maxVUs} VUs share ONE client IP until sessions exist.`,
        `Harp rate-limits /v1/* to ${IP_PER_WINDOW} req / ${WINDOW_SECONDS}s per IP,`,
        "so this ramp will flood 429 responses. k6 counts those as failed requests,",
        "and you would be measuring your own rate-limiter, not real hacker capacity.",
        "",
        "To run it meaningfully, mint per-VU session cookies and pass:",
        "  -e SESSIONS_FILE=sessions.json",
        "Or deliberately acknowledge the shared-per-IP mode and run it anyway:",
        "  -e FORCE_IP_MODE=1   (reads the status-code summary instead)",
        "",
        bar,
        "",
      ].join("\n"),
    );
    throw new Error(
      "aborting load.js: sessionless VU scale exceeds the per-IP rate budget (set FORCE_IP_MODE=1 to override)",
    );
  }
  console.log("load: exercising", BASE_URL, "users-per-window:", USER_PER_WINDOW,
    "window(s):", WINDOW_SECONDS,
    ipLimited ? "(SESSIONLESS — shared per-IP budget)" : "(sessions — per-user budget)");
  return {};
}

function authedHeaders(cookie) {
  return cookie ? { "cookie": cookie } : {};
}

export default function () {
  const cookie = sessionCookie(__VU);
  const headers = authedHeaders(cookie);
  const authed = hasSessions();

  // Read-mostly hacker surface. Each request paced to stay under the per-user
  // budget when sessions are in play.
  const endpoints = authed
    ? ["/v1/applications/me", "/v1/points-config", "/v1/auth/me"]
    : ["/v1/points-config"];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(BASE_URL + path, { headers });

  // Surface the actual status-code spread. The Counter is exported to CSV/JSON; the
  // checks below make 200 vs 4xx/429 vs 5xx visible in the console summary too.
  statusCodes.add(1, { code: String(res.status) });
  infraErrors.add(res.status >= 500);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "status is 2xx/3xx": (r) => r.status >= 200 && r.status < 400,
    "returns a data envelope": (r) => (r.body || "").indexOf("data") >= 0,
    "not rate-limited (429)": (r) => r.status !== 429,
  });
  if (res.status >= 429) {
    apiErrs.add(1);
  }

  // Occasionally load the public schedule (no auth”.

  if (Math.random() < 0.3) {
    const sched = http.get(BASE_URL + "/v1/public/schedule", { headers });
    statusCodes.add(1, { code: String(sched.status) });
    infraErrors.add(sched.status >= 500);
    check(sched, {
      "schedule is 200 or 403": (r) => [200, 403].includes(r.status),
    });
  }

  // Pace: at most 25% of the per-user window per iteration, spread over
  // the sleep., which keeps many VUsacross their own windows..
  sleep(jitter(400, 900));
}
// Opt-in reviewer/admin lane: GET the admin applications list or the pending
// reviews queue. Only spawned when ADMIN_LANE=1 AND a session pool is set,
// so a default hacker-only run never touches admin routes. 4xx (e.g. 403 fora
// non-admin session) is surfaced via checks, not silently swallowed..
export function reviewer() {
  const headers = { "cookie": sessionCookie(__VU) };
  const path = Math.random() < 0.5
    ? "/v1/admin/applications"
    : "/v1/admin/reviews/pending";
  const res = http.get(BASE_URL + path, { headers });
  check(res, {
    "admin read is 200 or 4xx":(r) => r.status >= 200 && r.status < 500,
    "admin read is not an infra error 5xx":(r) => r.status < 500,
  });
  sleep(jitter(200, 600));
}