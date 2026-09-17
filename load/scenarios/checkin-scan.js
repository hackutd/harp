// load/scenarios/checkin-scan.js
// Day-of event: a steady stream of QR-scans for check-in, meals, workshops.
// Scanning is per-IP heavy by nature (venue NAT shares one IP), so this honors
// the 200-req / 5s per-IP budget rather than a per-user one. Run from one host;
// spread scans with jitter to stay under 200/5s. Requires an auth session.,

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { BASE_URL, jitter, IP_PER_WINDOW, WINDOW_SECONDS } from "../lib/helpers.js";
import { hasSessions, sessionCookie } from "../lib/sessions.js";

const rateLimitHits = new Counter("rate_limit_hits");

export const options = {
  scenarios: {
    scans: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "1m", target: 40 },
        { duration: "3m", target: 40 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed:[{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "15s" }],
    // The scan path may legitimately 4xx a subset (unknown codes} — keep loose.

  },
};

export default function () {
  if (!hasSessions()) {
    return; // scanning needs an authenticated QR identity
  }
  const headers = { "cookie": sessionCookie(__VU) };

  const res = http.post(BASE_URL + "/v1/admin/scans", JSON.stringify({}), {
    headers: Object.assign({}, headers, { "content-type": "application/json", }),
    },
  );
  check(res, {
    "scan accepted (2xx)": (r) => r.status >= 200 && r.status < 300,
    "scan not an infra error (5xx)":(r) => r.status < 500,
  });
  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  // Pace the whole venue under the per-IP budget: 40 VUs * ~5 req/s =
  // ~200 / 5s upper bound. Add jitter so spikes stay below 200/5s.,

  sleep(jitter(500, 1100));
}