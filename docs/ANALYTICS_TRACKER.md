# Be Fit ERA — Admin Analytics Tracker

> **Purpose:** Track the step-by-step build-out of real analytics on the admin Overview page (`/admin`). Replaces the placeholder mock chart with real queries and adds new metrics incrementally so progress stays easy to resume.
>
> **Last updated:** 2026-08-05
> **Status legend:** `⬜ Not started` · `🔄 In progress` · `✅ Done` · `⏸ Blocked`
> **Scope decision:** All analytics live on the existing `/admin` Overview page (`AdminDashboard.tsx` + `getAdminStats()` in `app/actions/admin-actions.ts`). No new route.

---

## Data sources confirmed

| Metric area | Table(s) | Key columns |
|---|---|---|
| Registrations trend | `race_registrations` | `registered_at`, `status` |
| Payments/revenue | `race_registrations` + `races` | `payment_status` (pending/paid/refunded/failed), `races.registration_fee` (NUMERIC, per race) |
| User growth | `profiles` | `created_at`, `role` (runner/organizer/admin) |
| Race & engagement health | `races`, `activity_entries`, `community_posts` | `races.category`/`event_date`, `activity_entries.is_flagged`, `community_posts.created_at`/`likes_count` |

Note: there is no separate "orders" table — a registration's paid amount is `races.registration_fee` at the race it belongs to, joined via `race_id`. `paymongo_session_id` on `race_registrations` confirms payment came through PayMongo checkout (`app/api/checkout/route.ts`, `app/api/webhook/paymongo/route.ts`).

---

## Steps

### Step 1 — Real registrations trend ✅ Done

**Problem:** `getAdminStats()` returns hardcoded `registrationsPerMonth` (Jan–Jun mock array) instead of a real query.

**Design:**
- Query `race_registrations.registered_at`, group by month (last 6 months) in JS after fetch (dataset is small; avoids needing a Postgres RPC).
- Keep the existing `AdminStats.registrationsPerMonth` shape (`{ month: string; count: number }[]`) so `AdminDashboard.tsx`'s chart needs no changes.

**Verification:** Overview page chart reflects actual registration counts per month instead of the static mock values.

---

### Step 2 — Payments/revenue breakdown ✅ Done

**Design:**
- Add counts by `payment_status` (pending/paid/refunded/failed) as a small stat/bar breakdown.
- Compute total revenue = sum of `races.registration_fee` for registrations where `payment_status = 'paid'` (join registrations → races).
- New fields on `AdminStats`: `paymentStatusBreakdown: { status: string; count: number }[]`, `totalRevenue: number`.

**Verification:** Numbers match manual count of `race_registrations` rows by `payment_status`, and revenue total matches sum of `registration_fee` for paid rows.

---

### Step 3 — User growth ✅ Done

**Design:**
- New signups per month from `profiles.created_at` (same grouping approach as Step 1).
- Optional breakdown by `role` (runner/organizer/admin) as a stacked or secondary chart.
- New field: `AdminStats.newUsersPerMonth: { month: string; count: number }[]`.

**Verification:** Matches manual count of `profiles` grouped by month.

---

### Step 4 — Race & engagement health ✅ Done

**Design:**
- Race participation by category (`races.category` joined with registration counts).
- Dispute volume trend (`activity_entries` where `is_flagged = true`, grouped by month).
- Community activity (posts per month from `community_posts.created_at`, optionally total `likes_count`).

**Verification:** Spot-check against `/admin/disputes` list and `/admin/races` counts already shown elsewhere in the admin panel.

---

## Notes

- All queries go through `requireAdmin()` in `app/actions/admin-actions.ts`, matching the existing pattern for every other admin data fetch.
- Chart library: `recharts` (already installed, already used for the registrations line chart). New charts should reuse the same styling conventions as the existing chart in `AdminDashboard.tsx`.
- Follow-up idea (not scheduled): move date-bucketing into a Postgres RPC/view if row counts grow large enough that in-JS grouping becomes slow.
