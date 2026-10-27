# ResTix

**spare wristband? sorted.** A campus ticket exchange for verified students. List the fest
wristband or ticket you can't use, find the one you need, sort the handover on campus. Built
for Shiv Nadar University first; any college can be added through configuration.

ResTix connects people. It never handles money: no payments, no fees, no escrow, no refunds.

## What it does

- **Google sign-in, campus only.** Exact-domain allowlist enforced on the server on every
  request; verified email required. Email addresses are never shown to other students.
- **Events with resale rules.** Moderators add events with a stated policy source: resale
  allowed, face value only (price capped), not allowed (blocked), or unconfirmed (listings go to
  review). Cancelled and finished events drop out automatically.
- **Listings as wristbands.** Wristband, digital, paper or other; quantity, asking and original
  price, handover method and a public meetup spot. Contact details are blocked from public text.
- **Discovery.** Search, filters (event, kind, format, price, date, open to offers), sorting,
  pagination. The sell form shows a live preview of your band as you type.
- **Requests, not chat.** A buyer asks; the seller accepts and chooses what to share (their
  WhatsApp or a note) with that buyer only. Both sides can record how it went.
- **Bargaining in the app.** On "open to offers" listings the buyer can send an offer with the
  request; then either side counters, takes or passes until a price is agreed. Rules (never above
  the asking price or face value, only the other side accepts) live in the database. It records a
  number; money still changes hands in person.
- **WhatsApp hand-off.** Once the seller shares their number, the buyer's "Message on WhatsApp"
  opens a chat with the first message written (which ticket, the listed and agreed price).
  Sellers get a ready-made post for their group chats. Numbers are never public.
- **Feels like campus.** Event tints, a countdown to the next event, casual copy where it fits
  and plain words for money, safety and errors. Light and dark mode.
- **Own photos, watermarked.** `npm run photos` stamps the ResTix mark on event photos and
  strips their metadata (GPS, device) before they go on the site.
- **Trust and safety.** Reports with priorities, a moderation queue, hide/remove/restore,
  restrict/suspend/reinstate, appeals, and an append-only audit log.
- **Honest analytics.** First-party events and an admin dashboard: adoption, listings,
  listing-to-request conversion, time to first request, report rates, moderation times and
  self-reported outcomes. Sample data never counts. See docs/ANALYTICS.md.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS v4 · Postgres (Supabase in
production, PGlite locally) · Supabase Auth with Google · zod · Vitest · Playwright.

## Run it locally (no Docker, no Supabase account)

Prerequisites: Node 20.9+ (tested on 24), npm, Google Chrome (for E2E tests).

```bash
npm install
cp .env.example .env.local          # defaults work for local dev
npm run db                          # terminal 1: local Postgres (PGlite) on :54329, seeded
npm run dev                         # terminal 2: http://localhost:3000
```

Sign in at `/sign-in` with the **Development sign-in** panel: three seeded students (one is an
admin) or any email (try `someone@gmail.com` to see the rejection). Seeded events are labelled
"Sample data". `npm run db:reset` starts over.

## Tests

```bash
npm run typecheck
npm run lint
npm test                 # unit + integration (RLS attacks and server flows on PGlite)
npm run build && npm run test:e2e   # Playwright against the production build
```

Results of the latest run are in docs/TESTING.md.

## Deploy

docs/DEPLOYMENT.md walks through Supabase, the Google OAuth client, hosting (read the plan-terms
note first), the first admin, the daily cron and backups.

## Docs

- docs/ARCHITECTURE.md: how it fits together and why
- docs/DATABASE.md: schema, constraints, RLS, triggers
- docs/SECURITY.md: threat model, controls, remaining risks
- docs/ANALYTICS.md: events, metric definitions, limitations
- docs/DEPLOYMENT.md: production setup
- docs/TESTING.md: what was tested and the results
- docs/DESIGN.md: visual direction and voice
- docs/BUILD_LOG.md: build progress and decisions

## Status

Release candidate. Not yet deployed; real Google sign-in has not been tested end to end (it
needs the institution's OAuth setup). Privacy and terms are templates that need institutional
review. See docs/BUILD_LOG.md for known limitations.
