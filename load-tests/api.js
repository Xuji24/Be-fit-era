/**
 * Be Fit Era — k6 Load Test: API Endpoints
 *
 * Tests key API routes under load (community feed, leaderboard, race listing).
 * Run: k6 run load-tests/api.js
 * With auth token: k6 run --env BASE_URL=https://yoursite.com --env AUTH_TOKEN=<supabase_jwt> load-tests/api.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("api_errors");
const apiLatency = new Trend("api_latency_ms", true);

export const options = {
  stages: [
    { duration: "20s", target: 20 },   // Ramp up to 20 VUs
    { duration: "2m",  target: 20 },   // Sustained load
    { duration: "10s", target: 0  },   // Ramp down
  ],
  thresholds: {
    http_req_failed:   ["rate<0.01"],   // <1% errors for API
    http_req_duration: ["p(95)<1500"],  // 95th percentile < 1.5s
    api_errors:        ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  return headers;
}

export default function () {
  const headers = getHeaders();

  group("Public API: Race listing page", () => {
    const res = http.get(`${BASE_URL}/race`, { headers });
    const ok = check(res, { "race page 200": (r) => r.status === 200 });
    errorRate.add(!ok);
    apiLatency.add(res.timings.duration, { endpoint: "/race" });
    sleep(0.3);
  });

  group("Public API: Leaderboard page", () => {
    const res = http.get(`${BASE_URL}/leaderboard`, { headers });
    const ok = check(res, { "leaderboard 200": (r) => r.status === 200 });
    errorRate.add(!ok);
    apiLatency.add(res.timings.duration, { endpoint: "/leaderboard" });
    sleep(0.3);
  });

  group("Public API: Community feed page", () => {
    const res = http.get(`${BASE_URL}/community`, { headers });
    const ok = check(res, { "community 200": (r) => r.status === 200 });
    errorRate.add(!ok);
    apiLatency.add(res.timings.duration, { endpoint: "/community" });
    sleep(0.3);
  });

  sleep(1);
}
