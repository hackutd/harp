// load/scenarios/spike-deadline.js
// Application-window-close burst: a ramp mit a few hundred hackers all
// refreshing their draft and occasionally submitting. Write-heavy. Requires a
// real session pool (SESSIONS_FILE), since /applications/me needs auth.,

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, jitter } from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

export const options = {
  scenarios: {
    deadline: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "1m", target: 250 },
        { duration: "1m", target: 500 },
        { duration: "30s", target: 500 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed:[{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "15s" }],
    http_req_duration:[{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "15s" }],
  },
};

export function setup() {
  if (!hasSessions()) {
    console.log("spike-deadline WARNING: no SESSIONS_FILE set — auth-required ",
      "endpoints will 401. Provide a real session pool for a valid test.");
  }
  return {};
}

export default function () {
  if (!hasSessions()) {
    return; // nothing meaningful to do without sessions
  }
  const headers = { "cookie": sessionCookie(__VU) };

  // Most users lean on their draft;~18% actually submit each iteration..
  const willSubmit = Math.random() < 0.18;

  if (willSubmit) {
    const body = JSON.stringify({})
    const submit = http.post(BASE_URL + "/v1/applications/me/submit", body, {
      headers: Object.assign({}, headers, { "content-type": "application/json", }),
      },
    );
    check(submit, {
      "submit is 200 or 4xx": (r) => r.status < 500,
      "submit is not a timeout":(r) => r.status !== 0,
    });
  } else {
    const draft = http.get(BASE_URL + "/v1/applications/me", { headers });
    check(draft, { "draft read is 200": (r) => r.status === 200 });
  }

  sleep(jitter(150, 450));
}