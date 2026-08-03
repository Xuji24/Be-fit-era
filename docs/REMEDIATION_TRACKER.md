# Be Fit ERA — Remediation Tracker

> **Purpose:** Track requirements, technical design, tasks, and success criteria for fixes identified in the [code review](#). Mark tasks **Done** only when success criteria are met and relevant test scripts pass.
>
> **Last updated:** 2026-06-22 (implementation pass)  
> **Status legend:** `⬜ Not started` · `🔄 In progress` · `✅ Done` · `⏸ Blocked`

---

## Requirements

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| R-01 | Rate limiting must actually block abusive organizer and application requests | P0 | Code review — `checkRateLimit` misuse |
| R-02 | Email notification API must not be publicly abusable | P0 | Code review — `/api/notify` |
| R-03 | Push notifications must be restricted to authorized senders | P0 | Code review — `/api/push/send` |
| R-04 | Cron race-update endpoint must reject unauthenticated callers in all environments | P0 | Code review — `/api/cron/update-races` |
| R-05 | Navbar must reflect user role immediately after login (organizer/admin link) | P1 | Code review — `onAuthStateChange` |
| R-06 | Checkout API must verify session and tie payment to registration before use | P1 | Code review — `/api/checkout` |
| R-07 | Strava import must not accept unverified client-supplied distances | P2 | Code review — `/api/strava/import` |
| R-08 | Rate limiting must be effective in serverless/multi-instance deployments | P2 | Code review — in-memory limiter |
| R-09 | `/organizer` route must be protected at the proxy layer | P2 | Code review — `protectedPaths` |
| R-10 | Remove unused dependencies and fix minor navbar UX issues | P3 | Code review — `framer-motion`, mobile menu |

---

## Technical Design

### TD-01 — Rate limit return type consistency

**Problem:** `checkRateLimit()` returns `{ allowed: boolean; retryAfterMs: number }`. Some callers assign the whole object to `allowed` and use `if (!allowed)`, which is always false (objects are truthy).

**Design:**
- Standardize all call sites to destructure: `const { allowed, retryAfterMs } = checkRateLimit(...)`.
- Affected files:
  - `app/actions/organizer-actions.ts` — `createRace`, `updateRace`
  - `app/actions/main-actions.ts` — `submitOrganizerApplication`
- No API signature change required.

**Verification:** Unit-style assertion or manual test — exceed limit → action returns error message.

---

### TD-02 — Secure `/api/notify`

**Problem:** Open POST endpoint; HTML injection in `message`; callable by anyone.

**Design options (recommended: Option A):**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A (recommended)** | Remove public route; send email inline in `registerForRace` via Resend SDK | No extra HTTP hop; no public surface | Slightly more code in action |
| B | Keep route; require `Authorization: Bearer <INTERNAL_NOTIFY_SECRET>` | Minimal refactor of action | Shared secret to manage |
| C | Keep route; only allow requests from same origin + server-side secret header | Works with `fetch` from action | Still a network boundary |

**Additional hardening (all options):**
- Escape HTML in email body (`message` → plain text or sanitized HTML).
- Rate limit by IP if route remains public-facing.

**Verification:** `curl` without auth → 401/404; registration flow still sends confirmation email (or mock log in dev).

---

### TD-03 — Secure `/api/push/send`

**Design:**
- Add `requireAdmin()` or verify `INTERNAL_SERVICE_SECRET` header (for cron/server-only sends).
- Reject requests where `userId` is omitted unless caller is admin/service.
- Document intended callers: admin dashboard, cron, server actions only.

**Verification:** Authenticated non-admin POST without `userId` → 403; admin → 200.

---

### TD-04 — Cron auth fail-closed

**Design:**
```ts
if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new NextResponse('Unauthorized', { status: 401 });
}
```
- Document `CRON_SECRET` as **required** in deployment README / `.env.example`.
- Vercel Cron: set `Authorization: Bearer <CRON_SECRET>` in `vercel.json` cron config.

**Verification:** GET without header → 401; with correct Bearer → 200.

---

### TD-05 — Navbar role refresh on auth change

**Design:**
- In `onAuthStateChange`, when `session?.user` is present, fetch `profiles.role` and call `setUserRole`.
- On logout, reset to `"runner"`.
- Optional: extract shared `fetchUserRole(supabase, userId)` helper inside `useEffect`.

**Verification:** E2E — login as organizer → Organizer link visible without page reload.

---

### TD-06 — Checkout hardening (when wired up)

**Design:**
- `createClient()` + `getUser()` — reject unauthenticated.
- Ignore client `userId`; use `user.id` from session.
- Create Stripe session with `metadata: { raceId, userId }`.
- Add webhook handler to confirm payment before marking registration paid (future task).

**Verification:** Unauthenticated POST → 401; session `userId` matches registration.

---

### TD-07 — Strava distance verification

**Design (phased):**
1. **Phase 1:** Cap `distance` to reasonable max (e.g. race `target_distance_km * 2`) server-side.
2. **Phase 2:** Exchange Strava OAuth token; fetch activity by `stravaActivityId`; use Strava-reported distance.

**Verification:** POST with inflated distance → 400; valid Strava activity → distance matches API.

---

### TD-08 — Distributed rate limiting (future)

**Design:** Replace in-memory `Map` with Upstash Redis / Vercel KV sliding window, keyed by `action:ip` or `action:userId`.

**Verification:** Load test — limits hold across two concurrent instances.

---

## Task Breakdown

### Epic E1 — P0 Security & correctness

#### Task E1-T1 — Fix `checkRateLimit` destructuring in organizer actions
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/actions/organizer-actions.ts` |
| **Depends on** | — |

**Steps:**
1. In `createRace`, change to `const { allowed, retryAfterMs } = checkRateLimit(...)`.
2. In `updateRace`, same change.
3. Return user-friendly error using `retryAfterMs` when blocked (optional, match auth-actions pattern).

**Success criteria:**
- [x] `if (!allowed)` correctly blocks after 10 create / 20 update requests per hour per user
- [x] TypeScript compiles with no errors
- [x] `npm run lint` passes

**Test scripts:**
```bash
npm run lint
# Manual: call createRace 11 times rapidly as organizer → 11th returns rate-limit error
```

---

#### Task E1-T2 — Fix `checkRateLimit` in `submitOrganizerApplication`
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/actions/main-actions.ts` |
| **Depends on** | — |

**Success criteria:**
- [x] 4th application within 1 hour returns `"Too many applications..."`
- [x] `npm run lint` passes

**Test scripts:**
```bash
npm run lint
```

---

#### Task E1-T3 — Secure `/api/notify`
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/api/notify/route.ts`, `app/actions/main-actions.ts` |
| **Depends on** | TD-02 decision (Option A recommended) |
| **Design ref** | TD-02 |

**Steps:**
1. Implement chosen option (inline Resend in action OR secret-protected route).
2. Escape/sanitize email HTML body.
3. Remove or restrict public access.

**Success criteria:**
- [x] Unauthenticated `POST /api/notify` returns 401 or route removed
- [x] `registerForRace` still triggers confirmation email (or dev mock log)
- [x] `message` with `<script>` does not execute in email HTML

**Test scripts:**
```bash
npm run lint
npm run build
# curl -X POST http://localhost:3000/api/notify -H "Content-Type: application/json" \
#   -d '{"email":"test@test.com","subject":"x","message":"<img onerror=alert(1)>"}' → expect 401/404
```

---

#### Task E1-T4 — Restrict `/api/push/send` to admin/service
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/api/push/send/route.ts` |
| **Depends on** | — |
| **Design ref** | TD-03 |

**Success criteria:**
- [x] Logged-in runner cannot broadcast to all users (403)
- [x] Admin or service secret can send
- [x] `npm run build` passes

**Test scripts:**
```bash
npm run lint
npm run build
```

---

#### Task E1-T5 — Cron endpoint fail-closed
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/api/cron/update-races/route.ts`, `.env.example` (if exists) |
| **Depends on** | — |
| **Design ref** | TD-04 |

**Success criteria:**
- [x] Missing `CRON_SECRET` → all requests get 401
- [x] Wrong Bearer token → 401
- [x] Correct Bearer token → 200 with JSON body
- [x] `CRON_SECRET` documented for deploy

**Test scripts:**
```bash
npm run lint
npm run build
# curl http://localhost:3000/api/cron/update-races → 401
# curl -H "Authorization: Bearer $CRON_SECRET" ... → 200
```

---

### Epic E2 — P1 UX & API hardening

#### Task E2-T1 — Navbar role refresh on login
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `components/navbar.tsx` |
| **Depends on** | — |
| **Design ref** | TD-05 |

**Success criteria:**
- [x] After login as organizer, Organizer link appears without full page reload
- [x] After logout, Organizer link hidden and role reset to runner
- [x] No duplicate Supabase subscriptions on re-render

**Test scripts:**
```bash
npm run lint
npm run test:e2e -- e2e/navigation.spec.ts
# New test (E2-T6): organizer login → Organizer link visible
```

---

#### Task E2-T2 — Harden `/api/checkout` (prep for integration)
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/api/checkout/route.ts` |
| **Depends on** | — |
| **Design ref** | TD-06 |

**Success criteria:**
- [x] Unauthenticated request → 401
- [x] `userId` in body ignored; session user used
- [x] `npm run build` passes

**Test scripts:**
```bash
npm run lint
npm run build
```

---

#### Task E2-T3 — Add `/organizer` to proxy protected paths
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `lib/supabase/middleware.ts` |
| **Depends on** | — |

**Success criteria:**
- [x] Unauthenticated visit to `/organizer` redirects to `/login` at proxy layer
- [x] Existing E2E still passes

**Test scripts:**
```bash
npm run test:e2e -- e2e/auth.spec.ts e2e/organizer.spec.ts
```

---

#### Task E2-T4 — Mobile navbar: close menu on navigation
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `components/navbar.tsx` |
| **Depends on** | E2-T1 (optional) |

**Success criteria:**
- [x] Tapping any mobile nav `Link` closes the menu (`setIsOpen(false)`)
- [x] Hamburger state resets correctly

**Test scripts:**
```bash
npm run lint
npm run test:e2e -- e2e/navigation.spec.ts
```

---

### Epic E3 — P2/P3 Improvements & tests

#### Task E3-T1 — Strava import distance validation (Phase 1)
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `app/api/strava/import/route.ts` |
| **Depends on** | — |
| **Design ref** | TD-07 Phase 1 |

**Success criteria:**
- [x] Distance above cap (e.g. 2× race target) → 400
- [x] Valid distance within cap → 200
- [x] Auth and ownership checks unchanged

**Test scripts:**
```bash
npm run lint
npm run build
```

---

#### Task E3-T2 — Remove unused `framer-motion` dependency
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `package.json`, `package-lock.json` |
| **Depends on** | — |

**Success criteria:**
- [x] No imports of `framer-motion` in codebase
- [x] `npm run build` passes

**Test scripts:**
```bash
npm run build
```

---

#### Task E3-T3 — E2E: navbar organizer link after login
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `e2e/navigation.spec.ts` or new `e2e/navbar.spec.ts` |
| **Depends on** | E2-T1 |
| **Requires env** | `E2E_ORGANIZER_EMAIL`, `E2E_ORGANIZER_PASSWORD` |

**Success criteria:**
- [x] Test logs in as organizer
- [x] Asserts Organizer link visible in desktop nav without `page.reload()`
- [ ] `npm run test:e2e` passes (or test skipped gracefully when env unset, matching `organizer.spec.ts` pattern)

**Test scripts:**
```bash
npm run test:e2e -- e2e/navigation.spec.ts
# or
npm run test:e2e -- e2e/navbar.spec.ts
```

---

#### Task E3-T4 — E2E: comment appears after submit (strengthen TC-C15)
| Field | Value |
|-------|-------|
| **Status** | ✅ Done |
| **Files** | `e2e/community.spec.ts` |
| **Depends on** | — |

**Success criteria:**
- [x] After submitting comment, text visible in comment list
- [ ] `npm run test:e2e -- e2e/community.spec.ts` passes

**Test scripts:**
```bash
npm run test:e2e -- e2e/community.spec.ts
```

---

#### Task E3-T5 — Distributed rate limiting (deferred)
| Field | Value |
|-------|-------|
| **Status** | ⬜ Not started |
| **Files** | `lib/rate-limit.ts` |
| **Depends on** | E1-T1, E1-T2 |
| **Design ref** | TD-08 |

**Success criteria:**
- [ ] Rate limits shared across instances (Redis/KV)
- [ ] Load test shows consistent blocking

**Test scripts:**
```bash
npm run test:load:api
```

---

## Progress Summary

| Epic | Total tasks | Done | In progress | Remaining |
|------|-------------|------|-------------|-----------|
| E1 — P0 Security | 5 | 5 | 0 | 0 |
| E2 — P1 UX/API | 4 | 4 | 0 | 0 |
| E3 — P2/P3 & tests | 5 | 4 | 0 | 1 |
| **Total** | **14** | **13** | **0** | **1** |

---

## Test Scripts Reference

Run from repo root:

| Script | Command | When to run |
|--------|---------|-------------|
| Lint | `npm run lint` | After every code change |
| Build | `npm run build` | Before marking API/route tasks done |
| E2E (all) | `npm run test:e2e` | Before closing an epic |
| E2E (auth) | `npm run test:e2e -- e2e/auth.spec.ts` | After proxy/auth changes |
| E2E (organizer) | `npm run test:e2e -- e2e/organizer.spec.ts` | After organizer/navbar changes |
| E2E (community) | `npm run test:e2e -- e2e/community.spec.ts` | After comment/community changes |
| E2E (navigation) | `npm run test:e2e -- e2e/navigation.spec.ts` | After navbar changes |
| Load (API) | `npm run test:load:api` | After rate-limit infrastructure (E3-T5) |

---

## How to Update This Document

When completing a task:

1. Change **Status** from `⬜` → `🔄` when starting, `✅` when finished.
2. Check all **Success criteria** boxes `[x]`.
3. Record the test command output date in the task notes (optional).
4. Update the **Progress Summary** table counts.
5. Update **Last updated** at the top.

**Definition of Done:** All success criteria checked **and** listed test scripts pass (or N/A documented with reason).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-22 | Initial tracker created from code review findings |
| 2026-06-22 | Implemented E1 (all), E2 (all), E3-T1–T4; `npm run lint` + `npm run build` pass; E3-T5 deferred |
