# Fitra Project Memory

> Living document — updated alongside the global memory at `~/.claude/projects/.../memory/`.  
> Last updated: 2026-08-03

---

## Project Overview

**Name:** Fitra (marketed as "Be Fit ERA")  
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (auth + DB + storage) · Tailwind CSS v4 · shadcn/ui · Resend (email) · Stripe (payments) · Web Push · Strava OAuth  
**Deployment:** Vercel (`vercel.json` present)  
**Testing:** Playwright (E2E) · k6 (load tests)  
**Entry point:** `app/(main)/page.tsx` → `components/pages/main/home/HomePage.tsx`

---

## Architecture

### Route Groups
| Group | Path | Auth |
|-------|------|------|
| `(main)` | public pages + protected pages | mixed — some server-side redirects |
| `(auth)` | login, signup, forgot/reset password | public |
| `(admin)` | admin dashboard sections | admin role required |

### Key Pages
- `/` — Home (hero, why-join-us, community highlights, sponsors, CTA)
- `/race` — Race listing (Supabase-fetched, falls back to static `data/races-data.ts`)
- `/race/[id]` — Race detail
- `/activities` — Runner activity log + Strava integration
- `/community` — Social feed (posts, comments, images)
- `/leaderboard` — Rankings by distance
- `/organizer` — Organizer dashboard (CRUD races, manage registrations)
- `/admin/*` — Admin sections (users, races, applications, disputes, contacts, sponsors, registrations)
- `/profile`, `/settings` — User profile and settings

### Server Actions (app/actions/)
| File | Responsibilities |
|------|-----------------|
| `auth-actions.ts` | Login, signup, logout, password reset |
| `main-actions.ts` | Contact form, organizer application submission, race registration |
| `organizer-actions.ts` | Create/update/cancel races, upload designs |
| `admin-actions.ts` | Manage users, approve applications, handle disputes |
| `community-actions.ts` | Create/delete posts and comments, upload images |
| `dispute-actions.ts` | File and resolve disputes |

### API Routes (app/api/)
| Route | Purpose |
|-------|---------|
| `/api/notify` | Internal email (now auth-protected — Option A implemented) |
| `/api/checkout` | Stripe checkout session creation (auth-gated) |
| `/api/cron/update-races` | Auto-update race statuses (CRON_SECRET required) |
| `/api/push/*` | Web push subscribe/unsubscribe/send (send restricted to admin/service) |
| `/api/strava/*` | OAuth flow, activity fetch/import, deauthorize |
| `/api/og/race` | Open Graph image generation for race pages |
| `/api/auth/callback` | Supabase auth callback |

### Supabase Tables (from migrations)
- `profiles` — user profile + role (`runner` | `organizer` | `admin`)
- `races` — race events (with design columns, status, fee, cutoff time, kit pickup)
- `race_registrations` — participant registrations
- `activity_entries` — logged runs/workouts
- `strava_connections` — OAuth tokens
- `leaderboard_entries` — aggregated distance scores
- `contact_submissions` — contact form data
- `sponsors` — sponsor records
- `community_posts` + comments + images — social feed
- `push_subscriptions` — Web Push endpoint storage
- `organizer_applications` — applications to become organizer
- `admin_audit_logs` — audit trail

### Shared Components
- `components/navbar.tsx` — Role-aware navbar (runner/organizer/admin links, mobile menu, real-time role refresh on auth state change)
- `components/profile-dropdown.tsx` — User menu
- `components/ui/gpx-map.tsx` + `gpx-map-inner.tsx` — GPX route visualization (Leaflet)
- `components/ui/reward-preview-carousel.tsx` — T-shirt/medal/certificate preview

---

## Development Rules (from `memories/development_rules.md`)
- **Modularize** components when they approach or exceed **500 lines** — split into sub-components for maintainability.

---

## Remediation Status (from `docs/REMEDIATION_TRACKER.md`)

All P0–P2 security tasks are complete. One P3 task deferred.

| Epic | Tasks | Status |
|------|-------|--------|
| E1 — P0 Security | 5/5 | ✅ All done |
| E2 — P1 UX/API hardening | 4/4 | ✅ All done |
| E3 — P2/P3 improvements | 4/5 | ✅ Done (E3-T5 deferred) |

### Remaining Open Item
**E3-T5 — Distributed rate limiting** (`lib/rate-limit.ts`)  
- Current in-memory `Map` limiter does not persist across Vercel serverless instances.  
- Design: replace with Upstash Redis / Vercel KV sliding window.  
- Blocked on: infra decision (no urgency, deferred from 2026-06-22).

---

## Pending Feature Enhancements

Identified from codebase scan (not in tracker yet):

### High Priority
1. ~~**Stripe webhook handler missing**~~ — ✅ Done (2026-08-03). Replaced Stripe entirely with PayMongo (`lib/paymongo.ts`). `api/checkout/route.ts` creates PayMongo checkout sessions. `api/webhook/paymongo/route.ts` verifies signatures and marks `race_registrations.payment_status = 'paid'`. Migration `20260803000000` adds `payment_status` + `paymongo_session_id` columns. Swap `PAYMONGO_SECRET_KEY=sk_live_...` + `PAYMONGO_WEBHOOK_SECRET` for production — no code changes needed.
2. ~~**Strava Phase 2 distance verification**~~ — ✅ Done (2026-08-03). Shared helper `lib/strava.ts` (`getStravaAccessToken`, `fetchStravaActivityDistanceKm`). `import/route.ts` now fetches the real Strava activity distance; client-supplied distance is ignored. `activities/route.ts` deduplicated to use the same helper.
3. ~~**Race registration fee display**~~ — ✅ Done (2026-08-03). `race/page.tsx` and `race/[id]/page.tsx` now fetch `registration_fee` from DB. Checkout reads it server-side, converts to centavos, uses PHP currency; free races skip Stripe. Fee shown in race modal and join modal confirm step. Card payments on paid races redirect to Stripe.

### Medium Priority
4. **E3-T3 success criteria gap** — `npm run test:e2e` for organizer navbar link test is unchecked (test written but not confirmed passing).
5. **E3-T4 success criteria gap** — community comment E2E test written but `npm run test:e2e` pass not confirmed.
6. **Race detail page (`/race/[id]`)** — no server-side fetching of real DB data observed; review whether it uses static or live data.
7. **GPX file upload/route display** — UI exists (`gpx-map.tsx`) but no migration or API route for storing GPX files found; likely incomplete.
8. **Kit pickup info + inclusions** — DB columns added (`20260515000000`) but not surfaced in race detail or join modal UI.

### Low Priority / Quality
9. **OG image route** (`api/og/race`) — exists but unclear if race detail page sets `<meta og:image>` pointing to it.
10. **Push notification UX** — `PushNotificationToggle` exists in settings but no admin UI to broadcast to all users from the admin dashboard.
11. **`proxy.ts` at root** — a standalone proxy file; unclear if actively used or a dev artifact.
12. **`fix_duplicate.ps1`** — PowerShell script at repo root; likely a one-off dev tool, safe to keep or clean up.

---

## Environment Variables Required
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations |
| `RESEND_API_KEY` | Email sending |
| `PAYMONGO_SECRET_KEY` | `sk_test_...` (sandbox) or `sk_live_...` (production) |
| `PAYMONGO_WEBHOOK_SECRET` | `whsec_...` from PayMongo dashboard — required for webhook signature verification |
| `NEXT_PUBLIC_APP_URL` | Base URL for redirect URLs |
| `CRON_SECRET` | Bearer token for `/api/cron/update-races` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `INTERNAL_SERVICE_SECRET` | Push send endpoint authorization |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth |
| `HCAPTCHA_SECRET_KEY` | hCaptcha verification |

---

## How to Keep This Updated

When implementing any feature in this project:
1. Update the relevant section above.
2. If a tracker item is completed, update the table in "Remediation Status."
3. Move completed enhancements from "Pending" to a "Completed" section.
4. Mirror important decisions to the global memory at `~/.claude/projects/.../memory/`.
