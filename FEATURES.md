# Application Features

## 1. Authentication & Roles
- **User Authentication**: Secure sign-up/login using Supabase Auth (Email/Password, Magic Link).
- **Role-Based Access Control (RBAC)**: Distinguishes between Standard Users (Runners), Organizers, and System Admins. Access and UI differ depending on the user's role.

## 2. Races & Events
- **Race Discovery**: Users can browse upcoming, active, and past virtual races.
- **Dynamic Race Timeframes**: Automated scheduling using pg_cron transitions race statuses (upcoming -> active -> past) at exact timestamps.
- **Race Registration**: Runners can sign up for races to compete with others.

## 3. Activities & Tracking
- **Activity Submission**: Runners can submit manual entries (distance, time, proof) for races.
- **Strava Integration (WIP)**: Automatic syncing of runs via the Strava API.
- **Live Event Feed**: Real-time race feed showing the latest participant activities globally.

## 4. Leaderboard & Gamification
- **Global & Race Leaderboards**: Displays top participants based on accumulated distance or specific race results.
- **Pace Tracking**: Calculates runner's mathematical pace to prevent cheating.

## 5. Anti-Cheat & Moderation
- **Community Moderation System**: Runners can flag mathematically impossible or suspicious activities directly from the race live feed.
- **Admin Dispute Dashboard**: Centralized dashboard for Admins and Organizers to review, resolve, or reject flagged activities to maintain a fair competitive environment.

## 6. Organizer Portal
- **Organizer Applications**: Standard users can apply for "Organizer" status.
- **Race Management**: Approved organizers can create, edit, and moderate their own unique race events.

## 7. GPX Route Mapping (Upcoming)
- **Interactive Maps**: Visualizing specific running routes and paths submitted by users or specified by race organizers using GPX file data over interactive map tools (e.g., Leaflet or Mapbox).
