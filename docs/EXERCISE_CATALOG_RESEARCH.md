# Exercise Catalog Research — What to Animate Next

Research pass to answer: if we move the AI coach from freely-named exercises
to a closed catalog (the "hard guardrail" discussed alongside this doc), what
needs to be in that catalog so the AI never has to reach outside it without
a real quality loss? This is the research half of that decision — it doesn't
decide hard vs. soft mode itself, see "What this doesn't decide" at the end.

## tl;dr

**~24 movement patterns total** closes the real gaps without padding the
list — see "Recommended catalog size" below for the breakdown, and "Build
log" for what's actually shipped so far (kettlebell swing, as of this pass).
The two most important findings aren't about which exercises — they're about
the equipment taxonomy:

1. **`pull_up_bar` and `kettlebell` had zero animated coverage.** Not "thin
   coverage" — zero. Any plan for a user with either tag got no visual for
   the one thing that tag is *for*. `kettlebell` is now closed — see
   "Build log" below.
2. **`full_gym` doesn't need its own dedicated exercises.**
   `equipment-guardrail.ts` already treats it as a superset — a full-gym
   user can be prescribed bodyweight/dumbbell/kettlebell/band work too — so
   building "full_gym-only" animations would be spending effort on a tag
   that's already served by everything else.

## Current inventory

| | Count | Names |
|---|---|---|
| Fully animated (`exercise-poses.ts`) | 9 | squat, lunge, calf-raise, high-knees, glute-bridge, step-up, single-leg-rdl, lateral-band-walk, **kettlebell-swing** |
| Photo-only (`exercise-library.ts`) | 9 | squat, push-up, plank, lunge, jumping jack, bird dog, high knees, reverse lunge, child's pose |
| — of which already redundant | 3 | squat, lunge, high knees are in *both* tables — the photo table is partly stale |
| Net photo-only-and-nothing-else | 6 | push-up, plank, jumping jack, bird dog, reverse lunge, child's pose |

Every animated exercise before this pass was tagged `bodyweight`.
`resistance_bands` (beyond the one band-walk), `pull_up_bar`, and `full_gym`
still have no dedicated coverage. `dumbbells` is still open too — the
kettlebell swing closes the `kettlebell` tag specifically, not `dumbbells`.

## Method

Organized by **movement pattern × equipment tag**, not by exercise name —
the alias system already means one animation covers many named variants
("squat" covers goblet squat, sumo squat, wall squat, ...), so the real unit
of catalog planning is the pattern, not the string the AI happens to write.
Every candidate below is filtered through the existing product scope —
running injury-prevention and strength, not a general gym split — and
sourced the same way the shipped exercises were (NASM/Cleveland-Clinic-style
citations), not eyeballed.

## Candidate catalog, by tier

### Tier 1 — upgrade existing photo-only entries

Already vetted as good exercises (they're in `exercise-library.ts` today) —
but a build-complexity correction on top of that vetting, found while
actually building the first new exercise: **push-up, plank, and bird dog all
need ground contact at the hands (and, for bird dog, a planted knee) —
`rig-skeleton.ts`'s `CONTACT_POINTS` currently only defines heel/ball/
upper-back/sacrum, nothing on the arms.** That's a real architecture
extension (the same shape of work that added the foot segment originally),
not just new pose data. They're not "cheap" the way Tier 1 first looked.

| Exercise | Pattern | Equipment | Why | Build complexity |
|---|---|---|---|---|
| Plank (front) | Anti-extension core | bodyweight | Core stability is the base layer under running posture and injury prevention. [Six Minute Mile](https://sixminutemile.com/post/6-core-strength-exercises-runners-should-do/) | Moderate — a static hold, so it can be solved as a single pose satisfying both the forearm and toe contacts at once, without needing the solver to handle two *moving* contacts simultaneously. |
| Push-up | Push | bodyweight | Upper-body/shoulder strength supports arm drive and running economy late in a race — weak arms force compensation through the legs. [Marathon Handbook](https://marathonhandbook.com/upper-body-workout-for-runners/), [Alpha Project Phyzio](https://www.alphaprojectphyzio.com/blog/upper-body-exercises-runners) | Hard — hands AND toes are both fixed while the body moves as a rigid plank between them; `rig-kinematics.ts`'s solver only derives the root from *one* contact at a time today. |
| Bird dog | Anti-rotation core | bodyweight | Engages core the same way running does — contralateral limb coordination. [Aligned Modern Health](https://alignedmodernhealth.com/core-exercises-runners-bird-dog-dead-bug/), muscle-thickness RCT ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11036226/)) | Hard — a four-point quadruped base (both hands, one planted knee, one planted shin/foot), harder than push-up's two-point case. |

Given that, these move to the *back* of the build order, not the front — see
"Suggested build order" below. Jumping jack, reverse lunge, and child's pose
stay lower priority regardless: reverse lunge likely just needs a keyframe
variant of the existing lunge rig; child's pose is a static stretch, not
really a "movement"; jumping jack is low-injury-relevance filler.

### Tier 2 — net-new, fills a real equipment gap

| Exercise | Pattern | Equipment | Why |
|---|---|---|---|
| ~~Kettlebell swing~~ — **built** | Hip hinge / posterior-chain power | **kettlebell** | Explosive hip extension is mechanically the same action as the running propulsion phase; runners who add swings see hip-extension strength carry into 5K times. [runlovers.it](https://runlovers.it/en/2026/kettlebell-swing-biomechanics-posterior-chain-power/), [Revo PT Denver](https://www.revoptdenver.com/blog/power-your-stride-kettlebell-swings-for-running-performance) |
| Assisted pull-up / flexed-arm hang | Vertical pull | **pull_up_bar** (currently 0 coverage) | The only remaining tag with zero coverage; pull strength supports the same posture/arm-drive case as push-ups. [Marathon Handbook](https://marathonhandbook.com/upper-body-workout-for-runners/) |
| Dumbbell Romanian deadlift (bilateral) | Hip hinge | dumbbells | Two-legged counterpart to the existing single-leg RDL; gives the `dumbbells` tag its first hip-hinge option. |
| Single-arm dumbbell row (or band row) | Horizontal pull | dumbbells / resistance_bands | "Rows strengthen the upper back, lats, and rear shoulders, which help maintain good posture and arm drive." [Marathon Handbook](https://marathonhandbook.com/upper-body-workout-for-runners/) |
| Clamshell | Hip abduction (isolated) | bodyweight | Direct companion to the already-built lateral band walk — weak hip abductors let the pelvis drop and the knee collapse inward, which is the IT-band/patellofemoral pain mechanism. 22 of 24 injured runners were pain-free after 6 weeks of this work. [RunnersConnect](https://runnersconnect.net/hip-strengthening-for-runners/), [Outside](https://www.outsideonline.com/health/training-performance/gluteus-medius-exercises/) |
| Side plank | Lateral core / hip stability | bodyweight | Targets glute medius as well as obliques — same injury mechanism as clamshell, different angle. [Outside](https://www.outsideonline.com/health/training-performance/gluteus-medius-exercises/) |
| Dead bug | Anti-extension core, loaded | bodyweight | Teaches neutral spine under contralateral limb movement — the control that plank/bird dog build on. [Aligned Modern Health](https://alignedmodernhealth.com/core-exercises-runners-bird-dog-dead-bug/) |

Dumbbell goblet squat is deliberately **not** listed as a separate build —
it's the existing squat rig plus a held prop, an aliasing/animation-variant
decision rather than new kinematics work.

### Tier 3 — high-value, defer

| Exercise | Pattern | Equipment | Why deferred |
|---|---|---|---|
| Single-leg pogo hop / ankle hop | Plyometric power | bodyweight | Well-evidenced (6-8 weeks of hopping improved running economy 2-8% in trials — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10011548/)), but landing mechanics are the hardest thing to depict safely in a demo — a subtly-wrong landing pose is worse than none. Wants its own careful IK pass, not a rushed one. |
| Box jump / depth drop | Plyometric power | bodyweight (reuses step-up's box prop) | Same landing-mechanics caution as above. |

Barbell/dumbbell hip thrust, originally listed here, turned out to already
be a non-issue: `exercise-animations.ts` aliases "hip thrust"/"hip thrusts"
straight to `glute-bridge` today. No new build needed — correction from the
first pass of this doc.

## Why `full_gym` doesn't get its own tier

`equipment-guardrail.ts` treats `full_gym` as a superset — its check is
`if (hasFullGym) continue`, meaning a full-gym user is never blocked from
bodyweight, dumbbell, band, or kettlebell exercises. Building "full_gym-only"
animations (barbell back squat, leg press, lat pulldown) would spend the
scarcest resource here — IK-authoring time — on a tag that's already served
by every other tier. Worth revisiting only after the other five tags are
solid.

## "Other places" — outdoor/track and travel

Travel/no-equipment doesn't need new catalog entries — it's the
`bodyweight` tag by another name, already the best-covered tier.

Outdoor/track work isn't one bucket, though — it splits cleanly into
animatable and not, and the earlier pass was wrong to wave the whole
category off. The dividing line is the same one that governs everything
else in this doc: does it have a discrete start/end pose, or is it a
pace-and-effort prescription with no joint-angle target?

**Animatable — genuine running-form drills, cyclic like the existing
high-knees/lateral-band-walk:**

| Exercise | Pattern | Why |
|---|---|---|
| A-skip / A-march | Cyclic, single-leg drive | The closest thing to a "missing sibling" of high-knees already in the codebase — same alternating-anchor cyclic structure, dorsiflexed drive leg instead of a straight knee lift. Directly running-form work, arguably more core to Fitra's focus than several Tier 2 strength items. |
| Butt kick (heel flick) | Cyclic, single-leg | Same alternating structure as high-knees, heel driving toward the glute instead of the knee driving up. |
| Carioca / lateral shuffle | Cyclic, lateral travel | Shares lateral-band-walk's lateral-translation solving, not a new technique — a genuine rebuild of an already-proven mechanism. |

These three are legitimately cheap, in the same sense kettlebell swing
turned out to be cheap: they reuse validated solver capability (cyclic
alternating anchors, lateral travel) rather than needing new ones. Worth
folding into the build order at the same priority as Tier 2, not treated as
a separate, lower-priority bucket just because they're outdoor drills.

**Text-only — pace/effort content with no pose to depict:**

Strides, hill sprints, easy runs, tempo runs. These are literally "run at
X effort for Y time/distance" — there is no discrete joint-angle target
distinct from running itself, so animating them would mean inventing a pose
rather than depicting one. This is exactly the same principle Tier 3's
plyometric caution rests on, taken to its logical end: a fabricated "this is
what a hill sprint looks like" pose would be worse than the honest
alternative, which is text guidance (effort level, form cues like "lean from
the ankles, drive the knees") through the run-prescription side of the plan,
not `exercise-poses.ts`.

## Recommended catalog size

**~24 total**: 9 now built (8 original + kettlebell swing) + 2 Tier-1
upgrades (plank, then push-up/bird-dog once the multi-contact solver work
happens) + 6 remaining Tier-2 net-new + 3 outdoor drills (A-skip, butt kick,
carioca), with Tier 3 still deferred and `full_gym` still deliberately not
built. Slightly above the original "~20-21" estimate because the outdoor
drills turned out to be real, cheap additions rather than out of scope.

## Build log

- **Kettlebell swing** — built and verified. Bilateral and symmetric
  (single heel anchor, no weight transfer), so architecturally identical in
  complexity to squat — the cheapest possible first build, and it closed a
  zero-coverage tag. Caught one real bug during the verification pass: the
  first draft of the arm angle *added* to the torso lean instead of
  cancelling it (following the wrong sign from the squat's forward-reach
  case instead of the RDL's near-plumb-hang case), which put the kettlebell
  higher at the "hike" position than at the top — backwards. Fixed by
  matching the RDL's pattern (a negative `upperArm` angle that cancels most
  of the torso lean); the forward-kinematics probe now shows the kettlebell
  monotonically lowest at the hike (0.68m) and highest at the float (1.31m,
  chest height), zero ankle slip, zero floor penetration, exact loop-seam
  match.

## What this doesn't decide

This tells you what the catalog should contain to be "enough." It doesn't
resolve hard vs. soft guardrail mode on its own — that's still worth
revisiting once these are built, with real data on how often the AI reaches
outside a ~24-item catalog for something genuinely necessary. If it
almost never does, hard mode's quality-ceiling cost turns out to be small
and the guarantee becomes worth taking. If it does so often, soft mode was
the right long-term call.

## Suggested build order

1. ~~Kettlebell swing~~ — done.
2. Outdoor cyclic drills (A-skip, butt kick, carioca) and the rest of
   single-anchor Tier 2 (dumbbell RDL, dumbbell/band row) — all reuse
   existing, already-validated solver capability. No new architecture.
3. `pull_up_bar` (assisted pull-up) — closes the last zero-coverage tag.
   Needs one new contact point (a grip point on the existing forearm bone,
   the same kind of small extension the kettlebell prop used, not a new
   bone) plus a genuinely new anchor type (hands-on-bar instead of
   feet-on-floor).
4. Clamshell, side plank, dead bug — each needs one new contact point on an
   existing bone (a lateral hip/shoulder point, side-lying orientation) but
   no multi-contact solving.
5. Plank — the multi-contact case, but solvable as a single static pose
   rather than needing the solver itself extended.
6. Push-up and bird dog — genuinely need `rig-kinematics.ts` extended to
   solve two (or four) simultaneous contacts. Real architecture work, not
   content authoring; don't rush this one.
7. Tier 3 (plyometrics), once there's appetite for the extra landing-
   mechanics care that work needs.
