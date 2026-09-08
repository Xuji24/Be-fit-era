-- ============================================================
-- Migration: Create legal_documents / legal_document_sections
-- ============================================================
-- Backs the admin-editable Privacy Policy and Terms of Service pages.
-- Section/intro content is Markdown, rendered on the public pages via
-- react-markdown. Seeded with the initial drafts written for Be Fit Era.

CREATE TABLE public.legal_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL CHECK (slug IN ('privacy-policy', 'terms-of-service')),
  title          TEXT NOT NULL,
  intro          TEXT NOT NULL DEFAULT '',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.legal_document_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  anchor      TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  position    INT NOT NULL DEFAULT 0,
  UNIQUE (document_id, anchor)
);

CREATE INDEX legal_document_sections_document_id_position_idx
  ON public.legal_document_sections (document_id, position);

-- updated_at should bump on every edit — reuses the same generic trigger
-- function the coach tables already defined for this (see
-- 20260806015349_create_coach_profiles_and_subscriptions.sql).
CREATE TRIGGER trg_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_coach_updated_at();

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legal documents are viewable by everyone"
  ON public.legal_documents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Legal document sections are viewable by everyone"
  ON public.legal_document_sections FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can update legal documents"
  ON public.legal_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

CREATE POLICY "Admins can manage legal document sections"
  ON public.legal_document_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- ─── SEED: Privacy Policy ───────────────────────────────────
WITH doc AS (
  INSERT INTO public.legal_documents (slug, title, intro, effective_date)
  VALUES (
    'privacy-policy',
    'Privacy Policy',
    $pp_intro$Be Fit Era ("Be Fit Era," "we," "us," or "our") runs a running-events platform where you can organize and join races, track running activity, and train with an AI coach. This Privacy Policy explains what personal information we collect, how we use and share it, and the choices you have.

By creating an account or using Be Fit Era, you agree to the collection and use of information as described here. If you don't agree, please don't use the service.$pp_intro$,
    DATE '2026-09-08'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id
)
INSERT INTO public.legal_document_sections (document_id, anchor, title, content, position)
SELECT doc.id, x.anchor, x.title, x.content, x.position
FROM doc, (VALUES
  ('information-we-collect', 'Information We Collect', $pp_1$We collect information you give us directly, information created as you use Be Fit Era's features, and information from third-party services you choose to connect. We do not require any of this beyond what a feature actually needs to work.

### Account information

- Email address and password (handled by our authentication provider, Supabase — we never see or store your password in plain text).
- If you sign in with Google, the name, email address, and profile photo Google shares with your consent.
- Profile details you add yourself: display name, avatar, bio, and role (runner, organizer, or admin).

### Race registration information

- Contact details, category/distance selection, and t-shirt size or similar entry details a race organizer requests.
- Payment confirmation status for paid races (see "Payment information" below — we never receive or store your card, GCash, or Maya credentials).

### Health, fitness & activity data

- Workouts, weight entries, food logs, and training-plan progress you log in the AI Coach.
- Runs, distance, pace, elevation, and GPS route data — either entered manually or imported from Strava.

This is sensitive information under most privacy laws. We only use it to power the features you've opted into (progress charts, plan personalization, activity verification) and never sell it.

### Strava data

If you connect Strava, we receive an OAuth access token and the activity data (distance, time, route, elevation) needed to import your runs and verify race-leaderboard entries against Strava's own numbers. Disconnecting Strava in Settings revokes our access and removes the stored token.

### AI Coach conversations

Messages you send to the AI Coach, and the plans/answers it generates, are stored so your chat history and training plan persist between sessions. To generate a reply, your message is sent to our AI provider (Groq, Google Gemini, or OpenAI, depending on configuration) for processing — see "How We Share Your Information" below.

### Community content

Posts, comments, likes, and images you share in the Community feed are visible to other users by design. Anything you post publicly can be seen, copied, or shared by others — post accordingly.

### Payment information

Race fees and AI Coach subscriptions are processed by PayMongo (GCash, Maya, QR Ph, and card). We receive a payment status and reference ID, never your full card number, GCash PIN, or banking credentials — those go directly to PayMongo and its payment channels.

### Location information

Race locations you search or a race organizer pins are geocoded to show a map. We don't track your device's live location in the background — location data we hold is either a race's address/coordinates or the route data from an activity you logged or imported.

### Push notifications

If you enable push notifications, your browser gives us a push subscription (an endpoint and encryption keys) so we can deliver race updates and coaching reminders. We don't receive any browsing activity through this — only what's needed to send a notification to that browser.

### Device, log & usage data

IP address, browser and device type, pages visited, and similar diagnostic/log data, collected automatically to keep the service secure, debug issues, and prevent abuse.$pp_1$, 1),

  ('how-we-use-information', 'How We Use Your Information', $pp_2$We use the information above to:

- Create and secure your account, and verify your identity.
- Let you register for races and let organizers manage those registrations.
- Generate and adapt your AI Coach training/nutrition plan, and respond to your messages.
- Import and verify Strava activities against race leaderboards.
- Show your progress charts (weight trend, macros, adherence, streaks).
- Operate the Community feed and display your posts/comments to other users.
- Process payments and send confirmations, receipts, and registration/coaching notifications.
- Send push and email notifications you've opted into (race updates, streak nudges, weekly digests).
- Detect and prevent fraud, abuse, or activity-data tampering (e.g. distances that don't match Strava's own record).
- Maintain, secure, and improve the service, and comply with legal obligations.

We do not use your health, fitness, or activity data to train third-party AI models, and we do not sell your personal information to anyone.$pp_2$, 2),

  ('cookies', 'Cookies & Similar Technologies', $pp_3$We use a small number of cookies and browser storage entries to run the app:

- **Strictly necessary:** Supabase session cookies that keep you signed in, and hCaptcha cookies that protect the login/signup forms from bots.
- **Functional:** your light/dark theme preference, and local flags like a dismissed banner.
- **Security:** a short-lived CSRF-state cookie during the Strava/Google OAuth handshake.

We don't currently run third-party advertising trackers or cross-site analytics cookies. You can block or delete cookies in your browser settings, but doing so will likely sign you out and may break the OAuth connection flows.$pp_3$, 3),

  ('how-we-share-information', 'How We Share Your Information', $pp_4$We share information only where it's needed to run the service, never to advertisers, and never as a data sale:

- **Supabase** — our database, authentication, and file storage provider. Hosts virtually all data described above.
- **PayMongo** — processes race and subscription payments (GCash, Maya, QR Ph, card).
- **Strava** — only if you connect your account, to import and verify activities.
- **Google** — only if you use "Sign in with Google."
- **Groq, Google Gemini, and/or OpenAI** — process AI Coach messages and plan-generation requests to produce a reply. Our provider is configurable and may fall back between them on outage/rate-limit; whichever is active receives only the message content needed to answer you.
- **Resend** — sends transactional email (registration confirmations, coach digests and nudges).
- **hCaptcha** — verifies you're not a bot on login/signup.
- Other runners, if you post in the Community feed, appear on a public leaderboard, or share a race — that content is visible by design.
- Race organizers, for registrants of their specific race (contact and registration details needed to run the event).
- Law enforcement or other parties, only where required by law, to enforce our Terms of Service, or to protect the rights, safety, or property of Be Fit Era, our users, or the public.

Each of these providers processes data under its own privacy policy and only for the purpose we've engaged them for.$pp_4$, 4),

  ('storage-security-retention', 'Data Storage, Security & Retention', $pp_5$Your data is stored in Supabase-managed Postgres with Row Level Security enabled, so database rules — not just application code — restrict a user to their own records, and admin/organizer access is role-gated at both the routing and database layer.

We keep your data for as long as your account is active or as needed to provide the service. If you delete your account, we delete or anonymize your personal information within a reasonable period, except where we're required to retain records (for example, payment records for tax/accounting purposes) or where data has already become part of another user's record (for example, a race leaderboard result, or a comment reply to your post).

No method of storage or transmission is 100% secure. If we become aware of a breach affecting your personal information, we'll notify you and the relevant authority as required by applicable law.$pp_5$, 5),

  ('your-rights', 'Your Privacy Rights & Choices', $pp_6$Wherever you're located, you can exercise the following through **Settings** in the app, or by emailing us at [hello@befitera.com](mailto:hello@befitera.com):

- **Access & correction** — view and update your profile, logged data, and account details.
- **Deletion** — request deletion of your account and associated personal data.
- **Disconnect third parties** — unlink Strava or Google sign-in at any time.
- **Withdraw consent** — turn off push notifications, or stop using a given feature (e.g. AI Coach) without affecting the rest of your account.
- **Portability** — request an export of your data in a common format.
- **Object/restrict** — object to a particular processing activity or ask us to limit how we use your data, subject to legal or contractual limits.

If you're in the Philippines, these rights are protected under the **Data Privacy Act of 2012 (Republic Act No. 10173)**, and you may also lodge a complaint with the **National Privacy Commission (NPC)**. If you're in the EU/EEA/UK, similar rights apply under the **GDPR**; if you're a California resident, similar rights apply under the **CCPA/CPRA**. We honor equivalent requests regardless of where you're located.$pp_6$, 6),

  ('international-transfers', 'International Data Transfers', $pp_7$Be Fit Era is built for the Philippine running scene, but some of our service providers (Supabase, our AI providers, Strava, Google) operate infrastructure outside the Philippines. When your information is transferred internationally, we rely on those providers' own security and compliance commitments (such as standard contractual clauses, where applicable) to keep it protected to a comparable standard.$pp_7$, 7),

  ('childrens-privacy', 'Children''s Privacy', $pp_8$Be Fit Era is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided us personal information, contact us at [hello@befitera.com](mailto:hello@befitera.com) and we'll delete it.$pp_8$, 8),

  ('third-party-links', 'Third-Party Links & Services', $pp_9$Our service links out to or integrates with third-party platforms (Strava, Google, PayMongo, social media). Once you leave Be Fit Era or interact directly with one of those platforms, their own privacy policy governs — please review it before sharing information with them.$pp_9$, 9),

  ('changes-to-this-policy', 'Changes to This Policy', $pp_10$We may update this Privacy Policy as our features or legal obligations change. If we make a material change, we'll notify you via in-app notice, email, or by updating the "Last updated" date above. Continued use of Be Fit Era after a change takes effect means you accept the updated policy.$pp_10$, 10),

  ('contact-us', 'Contact Us', $pp_11$Questions, requests, or concerns about this Privacy Policy or your personal information can be sent to:

- **Email:** [hello@befitera.com](mailto:hello@befitera.com)
- **Location:** Manila, Philippines$pp_11$, 11)
) AS x(anchor, title, content, position);

-- ─── SEED: Terms of Service ─────────────────────────────────
WITH doc AS (
  INSERT INTO public.legal_documents (slug, title, intro, effective_date)
  VALUES (
    'terms-of-service',
    'Terms of Service',
    $tos_intro$Welcome to Be Fit Era. These Terms of Service form a binding agreement between you and Be Fit Era ("we," "us," or "our") governing your use of our running-events platform — races, activity tracking, the AI Coach, and the Community feed.

Please read them carefully. Terms that limit our liability or affect your rights are important — pay special attention to the "AI Coach Disclaimer" and "Disclaimers & Limitation of Liability" sections below.$tos_intro$,
    DATE '2026-09-08'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id
)
INSERT INTO public.legal_document_sections (document_id, anchor, title, content, position)
SELECT doc.id, x.anchor, x.title, x.content, x.position
FROM doc, (VALUES
  ('acceptance-of-terms', 'Acceptance of Terms', $tos_1$These Terms of Service ("Terms" or "Agreement") govern your access to and use of Be Fit Era's website, mobile web app, and related services (the "Service"). By creating an account or otherwise using the Service, you agree to be bound by these Terms. If you don't agree, please don't use the Service.

You must be at least 13 years old to use Be Fit Era. If you're under 18, you may only use the Service with the involvement and consent of a parent or guardian.$tos_1$, 1),

  ('accounts', 'Accounts', $tos_2$You need an account to register for races, use the AI Coach, and post in the Community. You're responsible for keeping your login credentials confidential and for all activity under your account. Tell us immediately if you suspect unauthorized access.

You can create an account with an email and password, or sign in with Google. You agree to provide accurate information and to keep it up to date.

Be Fit Era supports three account roles — **runner**, **organizer**, and **admin** — with different permissions. Organizer access to create and manage races is granted through an application process and may be revoked for Terms violations.$tos_2$, 2),

  ('description-of-service', 'Description of Service', $tos_3$Be Fit Era provides:

- **Races & events** — browsing, registering for, and organizing running events, including maps, GPX routes, and leaderboards.
- **AI Coach** — a subscription-tiered personal training and nutrition experience, including chat, logging, and progress tracking.
- **Community** — a feed for posts, comments, and likes among runners.
- **Activity tracking** — manual logging or Strava-imported runs, with distance verification for race leaderboards.

We're continuously improving the Service and may add, change, or remove features at any time. We'll try to give reasonable notice before removing a feature you actively rely on.$tos_3$, 3),

  ('ai-coach-disclaimer', 'AI Coach Disclaimer', $tos_4$The AI Coach provides **general fitness and nutrition information generated by an automated system** — it is not a licensed physician, dietitian, physical therapist, or certified personal trainer, and nothing it produces is medical advice, diagnosis, or treatment.

Consult a qualified healthcare professional before starting any new training program, changing your diet, or if you have (or suspect you may have) a medical condition, injury, or are pregnant. You use AI Coach guidance, generated training plans, and exercise demonstrations at your own risk. Stop any activity that causes pain, dizziness, or discomfort and seek medical attention if needed.$tos_4$, 4),

  ('race-registration-payments', 'Race Registration, Fees & Payments', $tos_5$Race details (fees, categories, capacity, cutoffs, and kit inclusions) are set by the organizing party for that race, not by Be Fit Era, unless we are the organizer. Read the specific race listing carefully before registering.

Paid registrations and AI Coach subscriptions are processed through PayMongo (GCash, Maya, QR Ph, or card). Registration is confirmed once payment is verified; a race that reaches capacity may close registration before the listed deadline.

**Refunds and cancellations** are governed by the individual race's stated policy, or, absent one, are handled case-by-case by contacting the organizer or [hello@befitera.com](mailto:hello@befitera.com). AI Coach subscriptions can be cancelled any time in Settings; cancellation stops future billing but does not refund the current billing period unless required by law.$tos_5$, 5),

  ('user-conduct', 'User Conduct & Content Standards', $tos_6$When using Be Fit Era, you agree not to:

- Post content that is unlawful, harassing, hateful, sexually explicit, or that infringes someone else's rights.
- Falsify activity data, race results, or payment confirmations, or otherwise attempt to manipulate a leaderboard.
- Impersonate another person, race organizer, or Be Fit Era staff.
- Upload malware, scrape the Service at scale, or attempt to disrupt or gain unauthorized access to it.
- Use the AI Coach to generate content that violates these Terms or applicable law.
- Use the Service for any commercial purpose we haven't authorized (for example, unauthorized advertising in the Community feed).

We may remove content, suspend, or terminate accounts that violate this section, at our discretion and without prior notice where warranted.$tos_6$, 6),

  ('user-content-license', 'User-Generated Content & License', $tos_7$You retain ownership of the posts, comments, images, and other content you submit ("User Content"). By posting it, you grant Be Fit Era a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display that content solely to operate and promote the Service (for example, showing your post in the Community feed or your result on a leaderboard).

You're responsible for your User Content and confirm you have the rights to post it. Content shared in the Community feed is visible to other users by design.$tos_7$, 7),

  ('third-party-integrations', 'Third-Party Integrations', $tos_8$Connecting Strava or Google is optional and governed by your agreement with that provider as well as these Terms. We are not responsible for the availability, accuracy, or content of third-party services. Disconnecting a third-party integration in Settings revokes our access to it going forward.

Payments are handled entirely by PayMongo; your use of PayMongo is subject to its own terms, and Be Fit Era is not a party to your relationship with PayMongo or your bank/e-wallet provider.$tos_8$, 8),

  ('intellectual-property', 'Intellectual Property', $tos_9$The Be Fit Era name, logo, app design, and underlying software are owned by us or our licensors and protected by intellectual property law. Except for your own User Content, you may not copy, modify, distribute, or create derivative works from the Service without our written permission.$tos_9$, 9),

  ('disclaimers-liability', 'Disclaimers & Limitation of Liability', $tos_10$The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We don't guarantee the Service will be uninterrupted, error-free, or that activity/leaderboard data will always be perfectly accurate.

To the fullest extent permitted by law, Be Fit Era and its officers, employees, and partners will not be liable for indirect, incidental, special, consequential, or punitive damages, or for any loss of data, revenue, or goodwill arising from your use of the Service — including reliance on AI Coach guidance or participation in a physical race event.$tos_10$, 10),

  ('indemnification', 'Indemnification', $tos_11$You agree to indemnify and hold Be Fit Era harmless from any claims, damages, or expenses (including reasonable legal fees) arising from your violation of these Terms, your User Content, or your use of the Service.$tos_11$, 11),

  ('termination', 'Termination', $tos_12$You may stop using the Service and delete your account at any time in Settings. We may suspend or terminate your access if you violate these Terms, misuse the Service, or if required by law. Sections that by their nature should survive termination (such as Intellectual Property, Disclaimers, and Indemnification) will continue to apply.$tos_12$, 12),

  ('governing-law', 'Governing Law & Dispute Resolution', $tos_13$These Terms are governed by the laws of the Republic of the Philippines, without regard to conflict-of-law principles. Any dispute arising from these Terms or the Service will first be addressed informally by contacting [hello@befitera.com](mailto:hello@befitera.com); if unresolved, it will be subject to the exclusive jurisdiction of the courts of Manila, Philippines.$tos_13$, 13),

  ('changes-to-terms', 'Changes to These Terms', $tos_14$We may update these Terms as the Service evolves. Material changes will be announced via in-app notice, email, or by updating the "Last updated" date above. Continuing to use Be Fit Era after a change takes effect means you accept the updated Terms.$tos_14$, 14),

  ('contact-information', 'Contact Information', $tos_15$Questions about these Terms can be sent to:

- **Email:** [hello@befitera.com](mailto:hello@befitera.com)
- **Location:** Manila, Philippines$tos_15$, 15)
) AS x(anchor, title, content, position);
