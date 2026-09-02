---
name: fitra-motion-ui
description: Fitra's motion, glass, and loading-state design system — tokens, utility classes, and the responsible-use rules for skeletons/spinners/glass. Load this before adding animation, hover states, glassmorphism, or loading UI anywhere in be-fit-era.
---

# Fitra motion & glass design system

Fitra runs plain CSS (Tailwind v4 `@utility` + keyframes in `app/globals.css`) —
**no Framer Motion, no GSAP**. Keep it that way; the app is fast because the
animation layer has zero runtime cost beyond CSS. `tw-animate-css` is
installed only for Radix primitives (popover, select).

## Tokens (already in `app/globals.css`)

The Be-Fit-Era_UI_Redesign_Prompt.md redesign is complete: every component
reads the `--brand`/`--brand-hover`/`--brand-ink` tokens below via
`var(--brand)` etc. — the old `#FF5733` / `#FFB800` brand literals are gone
project-wide. Three deliberate exceptions remain, and should stay hardcoded:
gold/silver/bronze medal-rank colors (`leaderboard-podium.tsx`,
`leaderboard-table.tsx`, the Finisher's Medal card in `RaceDetailPage.tsx`,
`reward-preview-carousel.tsx`'s `theme="orange"`) are universal reward
semantics, not brand color; third-party brand colors (Strava, Facebook,
Messenger, Instagram, TikTok in `log-activity-panel.tsx` and
`share-race-popover.tsx`) are that platform's own mark, never Fitra's; and
contexts that can't read CSS vars — Three.js material colors
(`exercise-model-3d.tsx`), MapLibre DOM markers now use `var(--brand)` fine,
but the OG image route (`app/api/og/race/route.tsx`, satori/edge) and the
canvas dot-grid background (`dot-grid-background.tsx`) keep the token's hex
duplicated as a literal (`#FFB366`) — update those two by hand if the token
ever changes.

| Token | Light | Dark |
|---|---|---|
| Brand (primary orange) | `#FFB366` | same |
| Brand soft (light orange) | `#FFD9B3` | same |
| Brand hover | `#FFA64D` | same |
| Brand ink (text on brand fills) | `#1E1E1E` | same |
| Background | `#FFF6F0` | `#121212` |
| Surface | `#FFFFFF` | `#1C1C1E` |
| Surface muted | `#F2F2F2` | `#2A2A2E` |

`--brand-ink` flipped from white to dark text: the new primary orange is much
lighter than the old `#FF5733`, and white text on it fails contrast (~1.8:1).
`#1E1E1E` on `#FFB366` clears ~9:1. Any new brand-filled surface (buttons,
avatar chips, badges) should pair with `var(--brand-ink)`, not `text-white`.

Fonts: `font-raleway` (headings, buttons, labels — bold/geometric) and
`font-merriweather-sans` (body copy). Never introduce a third family.

## Utility classes (added in `app/globals.css`)

- **`.skeleton-shimmer`** — directional shimmer sweep for content-shaped
  loading blocks. Give the block the real content's dimensions so nothing
  reflows when it swaps in.
- **`.interactive-card`** — hover lift (`translateY(-3px)`) + brand-tinted
  shadow + border tint. The shared version of the one hover treatment that
  used to live only in `why-join-us.tsx`.
- **`.reveal` / `.is-visible`** — scroll-triggered fade+rise. Driven by
  `useReveal()` (`lib/hooks/use-reveal.ts`) or the `<Reveal>` wrapper
  (`components/reveal.tsx`), not applied by hand.
- **`.animate-bounce-confirm`** — spring overshoot pop, for confirming an
  action just completed (not for decorating page load).
- Pre-existing: `.animate-fade-in` / `.animate-slide-up` / `.animate-slide-in-left/right`
  / `.animate-scale-in` (entrance keyframes, currently used on the four auth
  pages) and `.custom-scrollbar` / `.scrollbar-hide`.

All of the above resolve to `prefers-reduced-motion: reduce` correctly — see
the consolidated block at the bottom of `globals.css`. Don't add a new
animation without adding its off-switch there too.

## Responsible skeleton/spinner rule

Two tools, two jobs — don't reach for either by default:

- **Spinner** (`animate-spin` / `Loader2`): short, indeterminate waits with
  no known content shape — button submits, auth/page-gate checks. Fine as
  full-page centered spinner when there's genuinely nothing to preview yet.
- **Skeleton + `.skeleton-shimmer`**: waits with a *known* content shape
  that take long enough to notice (roughly >500ms) — a list of cards, a
  plan grid. Match the real layout's dimensions exactly.
- Never skeleton something that resolves in <300ms — it reads as a flash,
  not a loading state.
- Reference implementations: `components/pages/main/coach/component/plan-skeleton.tsx`
  (the plan-generation wait, 7–20s) and the feed skeleton in
  `components/pages/main/community/CommunityFeedPage.tsx`.

## Glassmorphism rule

`backdrop-blur` only reads as "glass" when there's something busy behind it
to blur — a photo, a gradient, a colored blob. Over a flat page background
it does nothing but blur nothing, and just adds cost. Two categories:

1. **Modal scrim** — `bg-black/50 backdrop-blur-sm`, a dimmer, not a glass
   surface. This is the majority of `backdrop-blur` usage in the app and is
   correct as-is (race-modal, create-race-modal, etc.).
2. **Real glass** — `bg-white/12 backdrop-blur-xl border-white/25` (or the
   dark mobile-nav variant `bg-[#1A1A1A]/85 backdrop-blur-xl`), used where
   there's real content behind it: the hero's route-background canvas
   (`hero-section.tsx`'s eyebrow chip) and the mobile nav sheet
   (`navbar.tsx`). Don't add a glass surface over flat `bg-background` —
   convert it to a plain card instead.

## Implemented patterns (reference before adding more)

- **Hero** — plain photo + dark overlay + bottom fade, no background effect
  and no eyebrow chip. A canvas GPS-route effect and a glass chip were tried
  here and removed — keep the hero clean; it already carries a full-bleed
  photo, and effects don't earn their place stacked on top of one.
- **Plain-background texture** — `components/backgrounds/dot-grid-background.tsx`,
  adapted from react-bits' `DotGrid` (reactbits.dev): a canvas dot field that
  brightens toward the brand color near the cursor and springs on
  click/fast pointer movement. The original depends on `gsap` +
  `InertiaPlugin`; this re-implements the push-and-return as a plain
  damped-spring integrator inside its own rAF loop instead — **gsap is not,
  and should not become, a Fitra dependency** (this app is plain CSS +
  vanilla canvas/JS for animation, no exceptions without discussing it
  first). Respects `prefers-reduced-motion` by rendering one static frame
  with no pointer reactivity. **Rule: only on flat, non-photo section
  backgrounds** (used on `community.tsx`'s `bg-[#1A1A1A]` section) — never
  stack it over a photo/overlay hero, and never reach for it on a section
  that already has a background image. A WebGL `ogl`-based particle-field
  version of this was tried first and replaced with this dot grid — don't
  reintroduce `ogl` without checking in.
- **Scroll reveal** — `<Reveal>` wraps `WhyJoinUs` / `Community` / `Sponsor`
  in `HomePage.tsx`. Works fine wrapping async server components; it only
  needs a DOM node to observe.
- **Navbar glass-on-scroll** — `components/navbar.tsx`, a `scrollY > 24`
  threshold toggles flat → `bg-background/75 backdrop-blur-md border-b
  shadow-sm`. The nav is `sticky top-0` (it wasn't before).
- **Sliding pill tabs** — `PlannerPage.tsx`'s week switcher: a track
  (`bg-surface-2 rounded-xl`) with an absolutely-positioned pill measured
  via `ref.offsetLeft/offsetWidth` on the active tab, buttons `z-10`
  transparent so the pill is visible sliding underneath. Use this pattern
  for any future in-page tab switcher — do NOT use it for route-based nav
  (AdminSidebar, coach dashboard tiles) since those remount per navigation.
- **Bounce-confirm** — `day-card.tsx`'s workout checkmark. Keyed to the
  *click*, not the `done` prop (a local `bouncingId` state set on click,
  cleared after 450ms) — this is required so it never fires on initial load
  for workouts that were already complete before the page rendered.

## What's deliberately NOT done (don't add without asking)

- No fabricated trust stats (fake "10,000+ users" badges) — if adding a
  glass stat card, it must be real data from the DB, not a placeholder.
  `Community`'s stats row already has real numbers via `communityData`.
- No page-transition animation between routes — not requested, adds
  complexity to every route.
