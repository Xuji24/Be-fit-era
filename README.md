# Fitra

Fitra is a running-events platform: organize and join races, track activity, and train with an AI coach — built for the Philippine running scene.

## Inspiration

Fitra combines two things that usually live in separate apps: **Strava-style activity tracking and social running**, and an **AI personal-trainer experience**. Runners already log their kilometers on Strava and look for coaching elsewhere — Fitra pulls both into one place, on top of the piece neither of those apps solves well: actually organizing and joining local races.

## Features

### Races & events
- Browse and register for races (5K/10K/half/full marathon/ultra), with GCash/Maya/QR Ph payment via PayMongo, or free registration
- Organizer dashboard to create/edit races, pin a start location on a map, set capacity, registration deadlines, and upload race kits (t-shirt/medal/certificate designs)
- Race detail pages with an interactive map (pinned location or geocoded from the listed address), GPX route rendering, and a live leaderboard
- Registration capacity is enforced atomically — a race can't be oversold even under concurrent signups
- Activity verification: Strava-imported runs are distance-checked against Strava's API (not the client-supplied value) and flagged for admin review if they look off

### AI Coach
- Three-tier subscription (free trial, Starter, Pro) with onboarding that builds a personalized weekly/4-week training + nutrition plan
- Chat with the coach for quick questions, backed by a small retrieval-augmented knowledge base of fitness/nutrition articles
- Weight, food, and workout logging with progress charts (BMI trend, macro breakdown, adherence)
- 3D animated exercise demonstrations, generated procedurally from a kinematics/skeleton model rather than pre-rendered video
- Proactive coaching: streak-break nudges, weekly digests, and goal-reached celebrations via web push + email
- Metered usage (plan generations, chat messages) enforced atomically in Postgres so concurrent requests can't exceed a user's quota

### Community & activity
- Community feed for posts, likes, and comments among runners
- Strava OAuth connection to import activities, with CSRF-protected linking and automatic cleanup on disconnect
- Push notification subscriptions for race and coaching updates

### Admin
- Dashboard for managing users, race listings, registrations, organizer applications, sponsor logos, contact submissions, and flagged/disputed activity entries
- Role-gated (admin/organizer/runner) at both the routing layer and the database (Postgres RLS), not just in the UI

### Auth & accounts
- Email/password auth with hCaptcha on login/signup, password strength checks, and reset flow
- Google OAuth login
- Session refresh and route protection handled centrally in Next.js's `proxy.ts`

## Tech stack

### Framework & language
| Tool | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org) (App Router, Turbopack) | React framework — server components, server actions, and API routes in one codebase |
| [React 19](https://react.dev) | UI library |
| [TypeScript](https://www.typescriptlang.org) | Static typing across the app, actions, and API routes |

### Backend & data
| Tool | Purpose |
|---|---|
| [Supabase](https://supabase.com) (Postgres + Auth + Storage) | Primary database, authentication, file storage (race kit designs, community images, sponsor logos), and Row Level Security for per-user data isolation |
| `@supabase/ssr` | Cookie-based Supabase session handling for server components, server actions, and the proxy/middleware layer |
| Postgres `SECURITY DEFINER` functions | Atomic operations that can't be safely done as read-then-write in application code — race registration capacity, AI coach quota, and rate limiting all go through single-statement SQL functions |
| [Zod](https://zod.dev) | Runtime validation of AI-generated plan output before it's trusted and stored |

### AI
| Tool | Purpose |
|---|---|
| Groq / Gemini / OpenAI (provider-agnostic) | Chat replies and training-plan generation, swappable via env var with automatic fallback on rate-limit/outage |
| Gemini embeddings | Semantic search over the coach's knowledge-base articles |

### Payments & third-party integrations
| Tool | Purpose |
|---|---|
| [PayMongo](https://paymongo.com) | Race registration fees and AI Coach subscriptions (GCash, Maya, QR Ph) — signature-verified webhooks, idempotent against retries |
| Strava API | Activity import and distance verification, OAuth-linked per user |
| [web-push](https://www.npmjs.com/package/web-push) | Browser push notifications (VAPID) |
| [Resend](https://resend.com) | Transactional email (registration confirmations, coach digests/nudges) |
| [hCaptcha](https://www.hcaptcha.com) | Bot protection on auth forms |

### Maps & visualization
| Tool | Purpose |
|---|---|
| [MapLibre GL](https://maplibre.org) + CartoCDN basemaps | Interactive race-location maps and GPX route rendering |
| `@mapbox/polyline` / `xml2js` | Decoding Strava polylines and parsing GPX course files |
| [Three.js](https://threejs.org) / `@react-three/fiber` / `@react-three/drei` | Procedural 3D exercise-demonstration rig |
| [Recharts](https://recharts.org) | Progress charts — weight trend, macro split, weekly activity |

### UI & styling
| Tool | Purpose |
|---|---|
| [Tailwind CSS 4](https://tailwindcss.com) | Utility-first styling |
| [Radix UI](https://www.radix-ui.com) + [shadcn](https://ui.shadcn.com) conventions | Accessible, unstyled component primitives as the base for the design system |
| [Lucide](https://lucide.dev) | Icon set |
| [next-themes](https://github.com/pacocoursey/next-themes) | Light/dark theme switching |
| [Sonner](https://sonner.emilkowal.ski) | Toast notifications |
| [class-variance-authority](https://cva.style) / `clsx` / `tailwind-merge` | Component variant styling without class collisions |

## Testing & tooling

| Tool | Purpose |
|---|---|
| [Vitest](https://vitest.dev) | Unit tests — business logic, quota/rate-limit math, webhook handling, plan-schema validation (361 tests) |
| [Playwright](https://playwright.dev) | End-to-end tests across auth, races, organizer flows, community, activities, leaderboard, profile, and settings |
| [k6](https://k6.io) | Load/smoke/stress testing against the API and critical user flows |
| [ESLint](https://eslint.org) (`eslint-config-next`) | Linting |
| Supabase Security & Performance Advisors | Continuous RLS/index/function-privilege auditing on the live database |

```bash
npm test              # unit tests (vitest)
npm run test:e2e      # end-to-end tests (playwright)
npm run test:load:smoke   # quick load test
npm run lint           # eslint
```

## Architecture notes

- **No shared root layout** — `(main)`, `(admin)`, and `(auth)` are each their own root layout with their own `<html>`/`<body>`, since the admin panel and public app intentionally have different shells. Each route group carries its own `not-found.tsx`/`error.tsx` boundaries as a result.
- **`proxy.ts`** (Next.js 16's replacement for `middleware.ts`) refreshes the Supabase session and gates `/profile`, `/settings`, `/activities`, `/organizer`, and `/admin` on every request.
- **Defense in depth**: every sensitive route re-checks ownership/role server-side even where RLS would also catch it, and every counter/quota/capacity check is a single atomic SQL statement rather than a check-then-write in application code.
- **Rate limiting** is Postgres-backed (not in-memory), so limits hold across serverless instances rather than resetting per cold start.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See `.env.test.example` for the E2E test environment; production requires Supabase, PayMongo, Strava, VAPID, hCaptcha, and an AI provider key (Groq/Gemini/OpenAI) — see `lib/` and `app/api/` for the full list of variables each integration reads.

## Deploy

Built for [Vercel](https://vercel.com), including `vercel.json` cron schedules for race-status updates and proactive coach notifications.
