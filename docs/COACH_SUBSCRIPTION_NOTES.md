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

### 7. RAG knowledge base (chat citations)

Chat retrieval against `coach_knowledge_articles` (~20 original short articles
across training/nutrition/recovery/injury-prevention/mindset). Embeddings are
Gemini `text-embedding-004` (`lib/ai/embeddings.ts`), reusing the same
`GEMINI_API_KEY` already configured as the chat fallback — no new provider
account. `lib/coach/knowledge.ts` fetches the (small) corpus and scores it
in-process:

- **Embedding path**: cosine similarity against the query's embedding.
- **Lexical fallback**: a zero-dependency keyword-overlap scorer, used
  whenever embedding fails (missing key, network, timeout). Retrieval never
  hard-fails the chat reply — a lookup error just means `sources: []`.

No ANN index (`ivfflat`) yet — a full scan is fine at ~20 rows. Revisit if the
library grows into the hundreds. Run `npm run seed:coach-knowledge` after
adding new articles (it only backfills rows where `embedding IS NULL`, so
it's safe to re-run).

The chat UI (`chat-message.tsx`) shows a small "Sources: ..." footer on
assistant replies that used reference material.

### 8. Proactive coaching (weekly digest, streak nudges, goal celebration)

`app/api/cron/coach-proactive/route.ts` runs daily (`CRON_SECRET`-gated,
same convention as `update-races`) and sends three kinds of notification via
both push (`web-push`) and email (`Resend`), each independently toggleable in
Settings (`notification_preferences`, opt-out — a missing row means all
defaults are enabled):

- **Streak-break nudge**: fires once a user has gone 3+ days without a food
  or workout log. Dedup key is `streak-break:<last_logged_date>`, so it fires
  once per distinct quiet period rather than every day the user stays quiet.
- **Weekly digest**: Mondays only. Content is a plain template built from
  real numbers (`lib/coach/digest.ts`) — deliberately not an LLM call, for
  $0 cost and zero hallucination risk on user-facing stats.
- **Goal-reached celebration**: fires once ever, when the latest weigh-in
  crosses `coach_profiles.target_weight_kg` in the direction it sits relative
  to the weight captured at intake (`lib/coach/goals.ts`). Only covers
  weight-based goals — `target_body_shape` is self-reported and not
  auto-detected.

All three share one dedup mechanism: `coach_notification_log` has
`UNIQUE(user_id, kind, period_key)`, and the cron only sends after an insert
into that table actually succeeds (mirrors `coach_usage`'s atomic-claim
pattern, just for sends instead of quota).

Sends are inline in the cron route (direct `webpush.sendNotification` +
`sendEmail()`), not an HTTP hop through `/api/push/send` — see the note in
item 2 above about avoiding unnecessary internal hops.

**Not built**: per-notification-kind push toggles beyond the three switches
above; AI-personalized digest prose (templated on purpose, see above).

### 9. Training volume is set by the app, not the model

`lib/coach/prescription.ts` assigns sets, reps, and rest deterministically from
(experience level × goal × warm-up × rep-vs-time), and **always overrides**
whatever the model produced. `applyPrescriptions()` runs in
`generatePlanForUser()` after the equipment guardrail's corrective retry (which
can replace the whole plan) and before persistence.

The model is still asked for one prescription-shaped field — `mode`
(`"reps"` | `"time"`) — because it knows the movement and we would otherwise be
guessing from the exercise name. `detectEffortMode()` is the fallback when it
omits that.

Why override rather than clamp the model's numbers to a sane band:

- Clamping keeps the model's value whenever it lands in range, which is most of
  the time — so two generations for one profile still disagree. That is bounded
  variance, not determinism, and determinism is the property being asked for.
- `reps` was free text (`"10-12 per leg"`, `"AMRAP"`), so clamping needs a
  parser before it can compare anything, and the parser's failure modes buy
  *less* determinism.
- The "the model has context we don't" argument doesn't hold here specifically:
  the prompt never told it what rep scheme to target, so its numbers were
  stylistic priors from training data, not reasoning about this user.

**Do not re-add volume to the prompt.** The system prompt now says explicitly
that sets/reps/rest are discarded, and the user message carries an
`exercisesPerSession()` count so the model can still hit the user's session
length by adjusting exercise *count* — the lever it does control.

`plan-schema.ts` still accepts `sets`/`reps`/`durationMin`/`restSec`. That's
deliberate: `details` is `.strict()`, models emit those keys out of habit, and
removing them would turn every such generation into a hard validation failure.
They are parsed and ignored.

Existing plans keep their old `{ sets, reps: "8-12" }` shape — there is **no
backfill**, because rewriting a past plan's numbers is rewriting history and
plans get archived and regenerated naturally. `readExerciseDisplay()` reads both
shapes and never throws; it has the most adversarial tests in the suite because
it is what stands between dirty JSONB and a white screen.

### 10. Exercise visuals: hand-drawn 2D + an orbitable 3D model

`exercise-rig.tsx` + `exercise-rig.module.css` are a hand-drawn SVG figure with
per-limb CSS keyframes; `exercise-model-3d.tsx` (react-three-fiber, dynamically
imported so the ~900KB bundle never loads for a user who doesn't open a demo)
is a jointed capsule figure driven by the same angles via
`lib/coach/exercise-poses.ts`. Both are one animation per movement *pattern*
rather than per exercise name — `lib/coach/exercise-animations.ts` maps the
model's free-form names onto them via a curated alias table, the same approach
as `exercise-library.ts` and for the same reason: showing a squat animation for
a deadlift is worse than showing nothing.

The demo modal falls back in tiers so it is never empty: 3D (when WebGL is
available) → 2D animation → wger reference photo + steps → the neutral figure
as a placeholder. When an animation is showing, the photo is suppressed — two
visuals of the same exercise stacked reads as a bug.

`/coach/exercise-preview` is the QA harness.

### 11. The exercise set is running-focused, not a generic gym split

Confirmed with the product owner after a screenshot showed the 3D plank
rendering as a falling-superman pose instead of a supported hold: the set was
narrowed from 12 generic gym exercises to 8 running-injury-prevention and
strength movements (squat, lunge, calf raise, high knees, glute bridge,
step-up, single-leg RDL, lateral band walk), grounded in physio/sports-
medicine sources cited per exercise in `exercise-poses.ts`. Fitra is a running
platform; a coach that taught bench-press-style lifts didn't reinforce that.

**The plank bug was structural, not a tuning miss** — worth internalizing
before adding another exercise. Every joint defaults to "hanging at the
sides," which is only a correct rest pose for a *standing* body. `bodyPitch`
pitches the whole rig into prone/supine for floor work, but nothing gave the
arms a baseline shoulder rotation to bring them from "parallel to the spine"
to "reaching down to support the body" — so they stayed parallel to the
now-horizontal torso instead of perpendicular to it. Dropping all prone work
(push-up, plank, mountain climber) removed the bug's entire category rather
than working around it. `glute-bridge` is the one exercise that stays supine;
its arm keyframes are set explicitly at every frame (ported from the 2D CSS's
already-correct values) specifically to avoid this — see the BASELINE RULE
comment at the top of `exercise-poses.ts` before adding any non-standing
exercise in the future.

Nutrition/meal planning is untouched — this was a workout-side change only.

### 6. Quota reset is UTC

Daily quotas reset at UTC midnight = 8am Manila. Deliberate: a local-midnight
reset needs a per-user timezone the server doesn't reliably have. If this
becomes a complaint, store the user's timezone and compute the bucket from it —
`periodKey()` in `lib/coach/tiers.ts` is the single place to change.
