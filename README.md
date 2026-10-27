# ResTix

**spare ticket? sorted.** A ticket exchange for verified students. List the wristband, pass or
e-ticket you can't use, find the one you need. Nobody's phone number is shared until a seller
accepts a buyer; then both get one tap to WhatsApp. Any college can be added through
configuration.

ResTix connects people. It never handles money: no payments, no fees, no escrow, no refunds.

## What it does

- **Google sign-in, campus only.** Exact-domain allowlist enforced on the server on every
  request; verified email required. Email addresses are never shown to other students.
- **Events open by default.** Resale is allowed unless a moderator sets a restriction (face
  value only, no resale, or unconfirmed). Students only see events where resale is allowed or
  capped at face value. Cancelled and finished events drop out automatically.
- **Can't find your event?** Students can request it (name, start, venue, kind, details). It stays
  private until a moderator approves and publishes it, edits it first, or declines.
- **Listings drawn as the real ticket.** Wristband, paper, QR e-ticket, email, app transfer, pass
  or lanyard, token or coupon, or other; quantity, asking and original price, handover method and
  a public meetup spot. The listing form is three steps. Contact details are blocked from public
  text.
- **Multi-ticket deals and price signals.** Sellers can offer a lower per-ticket price for buying
  several. Listings priced well under face value (or under the typical price for that ticket
  type) get a "good deal" sticker; the seller's own "what I paid" is never used for this.
- **Discovery.** Search, filters (event, kind, format, price, date, open to offers, good deals,
  saved), sorting, pagination. Students can save listings to a private watchlist.
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
  and plain words for money, safety and errors. Light and dark mode. A wordmark logo with a ticket for the dot of the i.
- **Own photos, watermarked.** `npm run photos` stamps the restix wordmark on event photos and
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
