# Changelog

All notable changes to Fitra are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- CI pipeline (`.github/workflows/ci.yml`): lint, typecheck, unit tests, and build on every push and PR to `main`.
- E2E workflow (`.github/workflows/e2e.yml`): runs Playwright specs on push to `main` and on manual dispatch.
- Load-test workflow (`.github/workflows/load-test.yml`): manual k6 smoke/api/stress runs against an explicit target URL.
- `typecheck` script (`tsc --noEmit`) — no standalone type-checking gate existed before.
- `.env.example` documenting every environment variable the app reads.
- `robots.ts` and `sitemap.ts` for search engine crawling.
- Page-level metadata (title, description, OpenGraph, Twitter card) for the home and races-list pages; a site-wide `metadataBase` and default social preview for pages without their own.
- This changelog.

### Changed

- `NEXT_PUBLIC_SITE_URL` set to the production domain (`https://fitra.vercel.app`), replacing a `localhost` placeholder.
- Race detail page's OG-image fallback domain corrected to match the production domain.
- The E2E hCaptcha-bypass route (`app/api/e2e/login/route.ts`) now gates on a dedicated secret instead of `NODE_ENV`, since `next build && next start` always sets `NODE_ENV=production` and was silently breaking authenticated E2E runs in CI.
- `lib/email.ts` sends via Nodemailer over Gmail SMTP instead of Resend. Resend's `onboarding@resend.dev` sandbox address only delivers to the account owner's own inbox, and verifying a real domain wasn't affordable/available; Gmail SMTP sends to real recipients with no domain purchase required. `resend` package dependency removed.

### Fixed

- `.env` declared `PAYMONGO_SECRET_KEY` twice under separate "TEST MODE" / "LIVE MODE" comments; only the second was ever read. Collapsed to one declaration with a comment explaining how live-mode detection actually works.
- `.gitignore` blanket-ignored `.env*` and `.github/`, which silently excluded `.env.example`, `.env.test.example`, and every file under `.github/workflows/` (including the new CI/E2E/load-test workflows) from version control. Scoped the `.env*` rule with explicit exceptions and removed the `.github/` rule.

[Unreleased]: https://github.com/Xuji24/be-fit-ERA/commits/main
