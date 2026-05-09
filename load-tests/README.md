# Be Fit Era — Load Testing with k6

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```powershell
# Windows (winget)
winget install k6 --source winget

# Or via Chocolatey
choco install k6
```

## Test Suites

| File | Purpose | VUs | Duration |
|---|---|---|---|
| `smoke.js` | Public page availability smoke test | 10 | ~2 min |
| `api.js` | Key API endpoint latency test | 20 | ~2.5 min |
| `stress.js` | Stress test to find breaking point | up to 200 | ~23 min |

## Running Tests

```powershell
# Smoke test (local dev server must be running on :3000)
k6 run load-tests/smoke.js

# API test against staging
k6 run --env BASE_URL=https://your-staging-url.vercel.app load-tests/api.js

# Stress test (staging ONLY — never production)
k6 run --env BASE_URL=https://your-staging-url.vercel.app load-tests/stress.js

# With authentication token (get from browser DevTools → Application → Local Storage → supabase session)
k6 run --env BASE_URL=https://your-staging-url.vercel.app --env AUTH_TOKEN=<jwt> load-tests/api.js
```

## Thresholds

| Metric | Smoke/API | Stress |
|---|---|---|
| Error rate | < 2% / < 1% | < 10% |
| p(95) response time | < 2s / < 1.5s | < 5s |

## Output Example

```
✓ / status 200
✓ /race status 200
✓ /leaderboard status 200

http_req_duration............: avg=240ms min=120ms med=200ms max=890ms p(90)=450ms p(95)=620ms
http_req_failed..............: 0.00% ✓ 0 ✗ 840
errors.......................: 0.00% ✓ 0 ✗ 840
```
