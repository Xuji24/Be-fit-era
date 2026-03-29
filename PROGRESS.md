# Project Progress & Architecture

## 1. Overview
**Be Fit Era** is a full-stack Next.js web application designed to host virtual fitness races, maintain leaderboards, and allow athletes to track their progress, either manually or by connecting fitness APIs like Strava. 

## 2. Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS, Shadcn UI
- **Database / Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Integrations:** Strava API for automatic activity sync

## 3. Project Structure
The application code heavily utilizes the new Next.js App Router paradigm, split across route groups for cleaner middleware and layout application.
```
app/
 ┣ (admin)/       # Routes restricted to Admin users (Admin Dashboard, user management, race approvals, applications)
 ┣ (auth)/        # Authentication flows (Login, Signup, Forgot Password, Reset Password)
 ┣ (main)/        # Main user-facing application:
 ┃  ┣ activities/ # Manual activity logging and history
 ┃  ┣ contact/    # Support/Contact Form
 ┃  ┣ leaderboard/# Global and race-specific rankings
 ┃  ┣ organizer/  # Organizer dashboard (Create config & Update Races, monitor participants)
 ┃  ┣ profile/    # User profile management and dashboard
 ┃  ┣ race/       # Race browsing, details, and registration pages
 ┃  ┗ settings/   # User account settings
 ┣ api/           # Next.js API Routes (e.g., Strava OAuth callback webhook)
components/       # Reusable React components (UI components, Navigation, specific Page Sections)
lib/              # Configuration files and utilities (Supabase Client Setup, Rate Limiting, Validation schemas)
supabase/         # Database migrations, RLS policies, and triggers architecture
utils/            # Type definitions, constants, and miscellaneous utilities
```

## 4. Current Core Features & Flow
### Authentication Flow
- Users can sign up, log in, reset passwords. Handled securely via Supabase Auth.
- Sessions are maintained with middleware checking session states to protect restricted zones (`/admin`, `/profile`, `/organizer`).

### User Roles (`runner`, `organizer`, `admin`)
1. **Runner (Default)**
   - Can register for races, log activities manually or through Strava, and view leaderboards.
2. **Organizer**
   - Can apply through the platform to become an organizer.
   - Upon administrative approval, they manage their own series of races (`createRace`, `updateRace`, check runner stats).
3. **Admin**
   - Manage the entire platform, oversee user roles, process organizer applications, review system logs, and modify extensive platform features.

### Activity Tracking
- **Strava Connection:** Users link their Strava account via OAuth. Activities are pulled to verify distance and automatically accumulate into their registered race targets.
- **Manual Logging:** Fallback method for offline activities. Handled and cross-verified via Next.js server actions.

### Database Capabilities (Supabase)
- **Tables Setup:** Implemented via comprehensive SQL migrations (`profiles`, `races`, `race_registrations`, `activity_entries`, `strava_connections`, `leaderboard_entries`, `organizer_applications`).
- **Triggers:** Postgres triggers are in place to auto-accumulate distances onto registrations when new activities are added.
- **RLS Policies:** Row Level Security strict controls making sure organizers can only edit their races, and users can only view/edit their own private profiles, keeping multitenancy logic safe.

## 5. Recent Actions Completed
- **GPX Route Map Implementations:**
  - Built GpxMapInner using Leaflet & OpenStreetMap.
  - Implemented client-safe Next.js dynamic imports to bypass SSR DOM errors with Leaflet.
  - Automated GPX parsing from strings/URLs directly into map coordinates (xml2js) and integrated it into the Race Pages.
- **Automated DB Operations:** Utilized PostgreSQL pg_cron extension to implement automated checking and transitioning of Race Statuses without server-side compute!
- **Anti-Cheat Ecosystem:**
  - Created new Supabase migration adding is_flagged tracking on all runs.
  - Built a dynamic "Live Feed" (RaceRecentActivities.tsx) on Race Details that allows normal runners to report mathematically impossible activities.
  - Created a robust /admin/disputes Admin Dashboard allowing resolution or rejection of flagged runs.
- **Architectural Documentation Formed:** Generated VOCABULARY.md and FEATURES.md summarizing the technical stack, codebase paradigms, and architectural feature list for clearer developer onboarding. 
- Implemented `updateRace` server action logic targeting Organizer dashboard allowing updates correctly scoped to race ownership.
- Cache invalidation rules applied properly via `revalidatePath` mapping.
- Added comprehensive initial New User Guide.
- **Codebase Linting & Type Safety:** Performed comprehensive fixes on `edit-race-modal.tsx`, `my-active-races.tsx`, and `log-activity-panel.tsx` to resolve React state side-effect issues, undefined/any typing, and Next.js `<Link>` component usage warnings with zero errors remaining.
- Established strict development guidelines across `/memories/` for codebase modularization (especially for files approaching 500 lines).
- **Strava OAuth & Data Sync Overhaul:** 
  - Configured and validated local environment variables (`STRAVA_CLIENT_ID`, `CLIENT_SECRET`).
  - Fixed API data fetching bounds (switched chronological `before` param to `after`) to instantly show newer runs and restrict logging historical runs prior to the virtual race start date.
  - Stripped out placeholder "mock data" from authenticated user states in `activities/page.tsx`, directly fixing arbitrary UUID database rejection errors upon distance import.
- **UI Enhancements:** Restructured overflowing modal layouts to prevent dynamic dropdown clipping and introduced sleek, dark-mode compatible custom webkit scrollbars.
- **Settings Layout Refactoring:** Reorganized the settings page forms (`SettingsPage.tsx` and `organizer-application.tsx`) into a uniform grid structure for consistent layout sizes across all inputs.
- **Workspace Cleanup:** Pruned obsolete compilation logs, linting dumps, and experimental assets (e.g. `box.test`) from the project root.

## 6. Next Steps & Todo
- [ ] **Community Feed Page:** Build a social page where users can post pictures and run achievements (create, like, share, edit, delete).
- [ ] **Facebook Messenger Integration:** Connect and test race sharing functionality once the Fitra team's Facebook App ID is acquired. Update `share-race-popover.tsx` with the generated ID.
- [x] **Automated Race Timeframes:** Set up cron jobs or edge functions to automatically switch active races to "completed" status when their end dates pass.
- [x] **Anti-Cheat & Dispute Resolution:** Develop admin tooling to handle user disputes or flag suspicious manual activity logs vs. imported API logs (Strava).
- [x] **GPX/Map Visualizations:** Built Next.js `dynamic` mapping components using `react-leaflet`, properly parsed GPX files, and implemented interactive race route tracing on `RaceDetailPage.tsx`.
- [ ] **Performance & Pagination:** Optimize database queries for Global Leaderboards and implement infinite scrolling pagination to handle high participant volumes natively.
- [ ] **Race Cancellations & Refunds:** Formulate policy procedures and associated backend flows allowing organizers to manage race cancellations properly via connected payment gateways.
- [ ] **Finalize Post-launch QA:** Conduct end-to-end user acceptance testing across authentication, application, organization dashboard, and registration pathways.
- [x] Refactor remaining large components (if any) to abide by our new 500-line modularization rules.
- [x] Formulated API endpoints/PoC for notification services (Resend) (automated emails for race successful registration, completion, etc. via Resend or text messaging).
- [x] Expanded Administrative Dashboard with Recharts metrics (implement better analytical charts and dispute handling logs).
- [x] Developed PoC Stripe implementation endpoint logic depending on the user's chosen method (e.g., GCash, Card, internal point system). 




