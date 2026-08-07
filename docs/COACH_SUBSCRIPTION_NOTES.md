# AI Coach Subscriptions — Notes & Open Items

## What shipped

Three tiers, defined in one place: `lib/coach/tiers.ts`.

| | Free Trial | Starter | Pro |
|---|---|---|---|
| Price | ₱0 | ₱199/mo | ₱399/mo |
| Plan generations | 3 (one-time) | 4 / month | 6 / month |
| Chat messages | 20 (one-time) | 30 / day | 150 / day |
| Plan length | 1 week | 1 week | 4 weeks |
| Plan history | latest only | last 3 | unlimited |
| Plan-generation model | fast (default) | fast (default) | frontier (`AI_MODEL_PRO`) |
| Chat model | fast | fast | **fast** |
| Expiry | 14 days or quota | — | — |

### Why chat stays on the fast model at every tier

Plan generations are capped and their quality is user-visible, so the frontier
model earns its cost there. Chat volume is unpredictable and each turn is
cheap; a frontier chat allowance generous enough to feel worth ₱399 would cost
more per user than the subscription. This was a deliberate choice — see
"Alternatives considered" below.

### Enforcement

- `consume_coach_quota()` (SQL, `SECURITY DEFINER`) is the only writer of
  `coach_usage`. Atomic via `INSERT .. ON CONFLICT DO UPDATE .. WHERE count < limit`,
  so two concurrent requests on the last unit cannot both succeed.
- `lib/coach/quota.ts` wraps it and **fails closed** — if the meter is
  unreadable, the call is refused rather than given away free.
- Quota is claimed *before* the provider call and refunded if the call fails,
  so an AI outage never burns a user's allowance.
- Both metered call sites: `generatePlanForUser()` in
  `app/actions/coach-actions.ts` and `POST /api/coach/chat`.

## Alternatives considered (for when the numbers change)

1. **Frontier model for chat too, ~25 msg/day cap on Pro.** Rejected: the cap
   is small enough to feel stingy at ₱399.
2. **Frontier everywhere, Pro at ~₱699/mo.** Rejected as too high for the
   current market, but this is the option to revisit if users specifically ask
   for a smarter chat. It is the cleanest upgrade path — a fourth "Elite" tier
   with frontier chat, rather than changing Pro.

## Open items

### 1. ~~PayMongo webhook must set `tier`~~ — done

`app/api/webhook/paymongo/route.ts` now branches on `metadata.kind ===
"coach_subscription"`. It reads `user_id` + `tier` from the metadata and sets
`status = 'active'`, `tier = <purchased tier>`, `current_period_end = now() +
1 month` via a service-role client (`SUPABASE_SERVICE_ROLE_KEY`), matching the
pattern in `app/api/cron/update-races/route.ts`. Covered by
`tests/unit/paymongo-webhook.test.ts`.

### 2. Recurring billing is not implemented

`createSubscriptionCheckoutSession()` creates a **one-time** charge, not a
recurring mandate. A "monthly" plan today means: charged once,
`current_period_end` set a month out, and the user must re-purchase manually.
Real auto-renewal needs PayMongo's recurring-payment product.

### 3. Verify the cost model against real usage

The per-call peso figures behind these prices are estimates from typical
plan/chat token sizes — they were never measured against production prompts.
**Before advertising these prices publicly**, log real token counts per
generation for a week and re-check the Pro margin. Pro is intentionally the
thinnest margin; the 6-plan cap is what keeps it bounded.

### 4. Paying the AI provider from subscription revenue — NOT automated

Requested as a note only, not built. Recording the constraint so it doesn't
get picked up later as a straightforward feature:

- Automatically routing incoming PayMongo funds to pay the Groq/Gemini/OpenAI
  bill is **not** something to implement in the app. Provider billing is
  card-on-file at the provider, and an automated payout loop between a
  payment processor and a vendor is a finance/treasury decision with
  reconciliation and tax implications — not an application concern.
- The buildable version of this need is a **cost-vs-revenue dashboard**:
  log token usage per generation (provider, model, tokens, tier), price it,
  and show it against subscription revenue. That answers "is Pro profitable?"
  without moving any money. `coach_plans.generated_by` already records which
  provider and model served each plan, which is the natural starting point.

### 5. Trial semantics

The free tier is **3 plans + 20 chats OR 14 days, whichever ends first**.
Time-based expiry (`hasAccess`) and quota exhaustion (`outOfPlans` /
`outOfChat`) are tracked separately so the UI can tell "your trial ended" from
"you're out of messages today".

**Access denial must state the real reason.** `getCoachAccess()` returns
`deniedReason` (`not_started` | `trial_expired` | `cancelled` | `null`) and
`trialDaysLeft`. An early version inferred "your trial has ended" from a bare
`hasAccess: false`, which showed that message to:

- brand-new users who had never started a trial (`status: "none"`),
- users who had merely spent one quota while their trial was still running.

It also fired a toast on *every* dashboard/chat load, and both pages redirect
to `/coach/subscribe`, so bouncing between them repeated it.

Rules that keep this fixed:

- **Never derive "expired" from `hasAccess: false`** — branch on `deniedReason`.
- **Copy lives in `lib/coach/access-copy.ts`**, not inline in components, so it
  is unit-testable. `tests/unit/access-copy.test.ts` asserts the wording never
  claims the trial ended when it hasn't.
- **No toast on the access redirect** — the subscribe page states the reason in
  its own header. Use `router.replace` so Back doesn't re-trigger the redirect.
- **Spending a quota mid-trial is not the end of the trial.** The banner points
  at what still works ("You can still use your plan generations during the
  trial"), and the rest of the coach — planner, tracker, progress — stays
  usable for the full 14 days.
- **`EMPTY_QUOTA` reports `exhausted: true`** for users with no subscription
  row. Any copy keyed off `outOf*` must check `deniedReason === "not_started"`
  first or it will tell a new user they used up something they never had.

### 5a. The trial dead-end (fixed — do not reintroduce)

`saveIntake()` was originally the **only** code path that created a
`coach_subscriptions` row. Anyone whose row was missing — onboarded before this
table existed, or an interrupted onboarding — hit a closed loop:

1. `/coach` sees `hasAccess: false` and redirects to `/coach/subscribe`.
2. On `/coach/subscribe` the free card was hardcoded `disabled` (`isFree`), so
   the only tier they were entitled to could not be selected.
3. No route back into the coach.

Fixes, all of which must stay:

- **`startFreeTrial()`** in `app/actions/coach-subscription-actions.ts` is a
  second, idempotent path to create the trial row. It refuses if a row already
  exists, so it can never restart or extend a spent trial. RLS
  (`users_start_own_coach_trial`) plus the `UNIQUE (user_id)` constraint are the
  real enforcement — the check in the action is just for the error message.
- **`/coach` and `/coach/chat` self-heal**: on `deniedReason === "not_started"`
  they call `startFreeTrial()` and continue, instead of redirecting to pricing.
  A user entitled to a trial should never be shown a paywall.
- **`PricingCard` takes `canStartTrial`**: the free card is an actionable
  "Start free trial" when no trial exists, and only becomes the inert
  "Current plan" / "Trial used" once one does. Never hardcode the free card
  disabled — that is what created the dead end.

Note that "Current plan" being unclickable is *correct* and not part of this
bug: it is a status label for the tier the user is already on.

### 6. Quota reset is UTC

Daily quotas reset at UTC midnight = 8am Manila. Deliberate: a local-midnight
reset needs a per-user timezone the server doesn't reliably have. If this
becomes a complaint, store the user's timezone and compute the bucket from it —
`periodKey()` in `lib/coach/tiers.ts` is the single place to change.
