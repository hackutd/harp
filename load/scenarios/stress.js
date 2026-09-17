// load/scenarios/stress.js
// Breakpoint/stress: ramps in steps past the day-of ceiling until errors appear,
// finding the actual capacity of the current Cloud Run + Neon sizing.,

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, jitter } from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "1m", target: 1000 },
        { duration: "1m", target: 1500 },
        { duration: "1m", target: 2000 },
        { duration: "1m", target: 2500 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // No hard abort here = we WANT to observe the breaking point, not stop at it..
    http_req_failed: [{ threshold: "rate<0.5" }],
    http_req_duration: [{ threshold: "p(95)<5000" }],
  },
};

export default function () {
  const cookie = sessionCookie(__VU);
  const headers = cookie ? { "cookie": cookie } : {};
  const authed = hasSessions();

  const path = authed ? "/v1/applications/me" : "/v1/points-config";
  const res = http.get(BASE_URL + path, { headers });
  check(res, { "status is 200":(r) => r.status === 200 });

  sleep(jitter(100, 300)); // short think time keeps pressure high
}