/**
 * Be Fit Era — k6 Load Test: Stress Test
 *
 * Stress tests the app to find its breaking point.
 * Run: k6 run load-tests/stress.js --env BASE_URL=https://yoursite.com
 *
 * WARNING: Only run against a staging environment — not production.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "2m",  target: 50  },  // Normal load
    { duration: "5m",  target: 50  },  // Hold normal
    { duration: "2m",  target: 100 },  // Spike
    { duration: "5m",  target: 100 },  // Hold spike
    { duration: "2m",  target: 200 },  // Push to limit
    { duration: "5m",  target: 200 },  // Hold limit
    { duration: "2m",  target: 0   },  // Recovery
  ],
  thresholds: {
    http_req_failed:   ["rate<0.10"],   // Allow up to 10% errors under stress
    http_req_duration: ["p(95)<5000"],  // 95th percentile < 5s under stress
    errors:            ["rate<0.10"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const ENDPOINTS = ["/", "/race", "/leaderboard", "/community"];

export default function () {
  const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${path}`);
  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "duration < 5s": (r) => r.timings.duration < 5000,
  });
  errorRate.add(!ok);
  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s think time
}
