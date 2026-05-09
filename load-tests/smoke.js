/**
 * Be Fit Era — k6 Load Test: Public Pages Smoke
 *
 * Tests public-facing pages under load.
 * Run: k6 run load-tests/smoke.js
 * Run with env: k6 run --env BASE_URL=https://yoursite.com load-tests/smoke.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const pageLoadTime = new Trend("page_load_ms", true);

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // Ramp up to 10 VUs
    { duration: "1m",  target: 10 },  // Hold 10 VUs for 1 minute
    { duration: "30s", target: 0  },  // Ramp down
  ],
  thresholds: {
    http_req_failed:   ["rate<0.02"],    // <2% errors
    http_req_duration: ["p(95)<2000"],   // 95th percentile < 2s
    errors:            ["rate<0.02"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const PUBLIC_PAGES = [
  "/",
  "/race",
  "/leaderboard",
  "/community",
  "/contact",
  "/login",
  "/signup",
];

export default function () {
  for (const path of PUBLIC_PAGES) {
    const res = http.get(`${BASE_URL}${path}`, { tags: { page: path } });
    const ok = check(res, {
      [`${path} status 200`]: (r) => r.status === 200,
      [`${path} response < 3s`]: (r) => r.timings.duration < 3000,
    });
    errorRate.add(!ok);
    pageLoadTime.add(res.timings.duration, { page: path });
    sleep(0.5);
  }
}
