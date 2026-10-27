# ResTix build log

Persistent progress for the build described in the master prompt (CampusTix spec, product named
ResTix). Update after every milestone; newest log entries last.

## Environment (2026-10-27)

- Windows 11, Node 24.22, npm 11.19, git 2.55, Chrome stable. No Docker, no local Postgres,
  no Supabase CLI.
- Next.js 16.4.3 (App Router, Turbopack), React 19.3, Tailwind v4, TypeScript 5.9.
- Local database: PGlite 0.5.10 (Postgres 18 in WASM) over the wire protocol via pglite-socket
  0.2.13: the same `postgres` driver and migrations run locally, in tests and in production.
- Skills used: taste-skill (direction dealt, docs/DESIGN.md), impeccable craft floor (its
  launcher was blocked by the permission classifier, so the reference was read directly),
  model routing (Sonnet subagents for the Next 16 doc digest and the legal pages; an Opus
  subagent for the independent security review).

## Decisions

| Decision | Why |
| --- | --- |
| Name ResTix | Requested by the owner (spec's working name was CampusTix) |
| Gen Z voice, plain where it matters | Owner request; safety, money and errors stay exact |
| App tables in private `restix` schema | Unreachable through Supabase's Data API with the public key |
| Direct Postgres + `asUser` (role `authenticated` + claims) | RLS as a second layer; one driver everywhere |
| Cache Components off | Nearly every page is per-user; simpler to maintain |
| Contact via inquiries, seller shares contact on accept | No public numbers, no chat to moderate |
| No payment code | Spec |
| No evidence uploads | Not needed for the workflow; avoids storing ticket/receipt images |
| Dev sign-in behind AUTH_MODE=dev; refused in production builds and on Vercel | Full local testing without Google credentials |
| E2E against the production build with system Chrome | Tests what ships; no browser download |
| Nonce CSP from the proxy; legal/404 pages rendered per request | No inline scripts allowed |
| Moderation scoped per college in the DB | Multi-college ready without cross-college power |
| Deployment guidance flags Vercel Hobby's commercial-use wording | Listings "advertise the sale" of tickets; confirm before launch |

## Definition of done (status)

- [x] Runs locally with documented instructions (README)
- [x] Production build succeeds
- [x] Google OAuth implemented; exact manual configuration documented (not exercised: no credentials)
- [x] Institutional domain enforcement on the server, every request
- [x] Unverified/disallowed users can't bypass protected operations (app + RLS, tested)
- [x] Sessions and permissions handled (getClaims, httpOnly cookies, sign-out, guards)
- [x] Browse eligible events and listings
- [x] Create, edit, pause/resume, mark sold/unavailable, delete own listings
- [x] Wristband listings (in-person handover enforced)
- [x] Expiry and availability states (effective status on read + daily job)
- [x] Contact without payments
- [x] Event transfer policies respected (app + DB triggers)
- [x] Reporting and moderation (queue, actions, audit log, appeals)
- [x] Admin dashboard access controls (admin-only analytics, moderator pages)
- [x] Analytics from real recorded events; sample data excluded
- [x] Metric definitions and limitations documented (docs/ANALYTICS.md)
- [x] RLS and grants reviewed and tested (53 integration tests; independent review)
- [x] Private uploads: not implemented (documented)
- [x] Responsive layouts inspected (desktop + phone E2E, screenshots)
- [x] Accessibility tested (axe on 22 pages, keyboard tests); manual screen reader pass pending
- [x] Lint, typecheck, tests, build run and documented (docs/TESTING.md)
- [x] No known unresolved critical/high security issues
- [x] Documentation matches implementation
- [x] Deployment instructions complete (docs/DEPLOYMENT.md)
- [x] No fake users/metrics/verification claims; fixtures labelled "Sample data"
- [x] Remaining defects and manual steps documented (below, SECURITY.md, DEPLOYMENT.md)

## Known limitations / next actions

1. Exercise real Google sign-in on a Supabase project (DEPLOYMENT.md sections 2-5).
2. Confirm hosting terms (Vercel Hobby commercial-use question) before launch.
3. Institutional review of privacy and terms templates.
4. Manual screen-reader pass (NVDA/VoiceOver).
5. Optional: email notifications for new requests (needs a provider; not built, no claims made).
6. Event requests from students: built 2026-10-27 (see the log).
7. Analytics are deployment-wide if more than one college is added (see SECURITY.md).

## Log

- Scaffolded Next 16; pinned PGlite pair. Init migration with RLS; fixed three self-review gaps
  before testing (profile status self-edit, report priority spoofing, seller inquiry abuse).
- Unit tests 61 -> 95; RLS integration tests 28 on first run.
- Server modules (listings, inquiries, moderation, events, metrics) + flow tests; caught a
  camelCase bug in sign-in completion via a new returning-user test.
- Full UI: design tokens, wristband component, app shell, all student and moderator pages,
  landing page (one-motif direction), legal pages (Sonnet subagent), error pages, SEO files.
- Found in the browser: viewer fields undefined (camelCase), lost sign-in return path (fixed
  via proxy header), IST date parsing bug (fixed + tests), tints too close (fixed).
- Playwright E2E against the production build; found and fixed a KPI/chart inconsistency
  (sample data counted in one, not the other).
- axe accessibility scans: fixed one serious label mismatch; 0 violations on 22 pages.
- Independent security review: 1 High (open redirect), 5 Medium, 7 Low, 3 Info. All fixed with
  regression tests; hardening migration added. Then a nonce-based CSP with zero violations.
- Lighthouse (mobile, prod build): 94-98 performance, 100 accessibility and best practices.
- Phone review via headless screenshots: fixed landing hero overflowing 390px (grid track
  min-width), FAQ tabs overlapping cards, 44px touch targets; strengthened the phone E2E to catch
  clipped text even when overflow is hidden.
- Found my own UI promising a feature that didn't exist ("report a missing event"): built event
  suggestions (migration, RLS, student form, moderator queue, 3 integration tests).
- Landing: credited open-licence fest photos as one band under the hero (to be replaced by the
  owner's own concert photos), aligned safety tiles, a scroll-driven tape strip, a sticker.
- UI pass for a Gen Z feel: six event tints, bigger titles and filled count tiles, hover lift on
  bands, a dropped-band empty state, greetings, a "next up" countdown card in the sidebar.
- Found in dev: the persistent local DB had missed two migrations (pages 500'd); applied them.
- Bargaining (owner request): `offers` table with RLS and triggers (one open offer, never above
  asking or face value, only the other side accepts, agreed price only via an accepted offer),
  counters and deals in the inbox, an optional opening offer on the request. 6 integration
  tests (mostly attacks) and an E2E.
- WhatsApp hand-off (owner request): seller's number stored separately and only shared on accept;
  the buyer's button opens a chat with the message pre-written; sellers get a group-chat post.
- Watermark (owner request): `npm run photos` stamps the ResTix mark on the owner's photos and
  strips EXIF/GPS. Tested on pixels and metadata.
- E2E server now uses one DB connection: PGlite is one session, and concurrent transactions
  through the pool occasionally interleaved (`UNSAFE_TRANSACTION`). Real Postgres unaffected.
- axe caught two new contrast failures (tape strip text past its background; 85% white on the
  accent tile); fixed.
- Live wristband preview on the sell form. Phone check found /sell 476px wide at 390 (grid track
  min-width); fixed there and on three other detail grids; the phone E2E covers more pages.
- Owner's own concert photos and clips replace every borrowed picture (credits gone): hero band
  cut from a clip, a band of four photos, a full-width moment, clips on the closing line and
  sign-in, photos on the 404 and welcome pages. Found the baked watermark being cropped off by the
  layout: crops now anchor bottom-right and the importer can pre-cut (`@16x9,0.4`). Found the video
  becoming the LCP: poster is now a real priority image and clips load after the page.
  Lighthouse briefly showed 500s and 95/96 scores: a stale `next start` from an earlier session
  was still holding the port with an old build; re-measured on the right server (table in TESTING).
- New mark (owner: the band-and-tab logo read as something else): a tilted ticket stub with a
  smile and a sparkle, lowercase "restix", new favicon, link preview, watermark (photos and
  posters restamped). New footer with the giant cropped name. CSS-only motion; the scroll reveal
  script was replaced by scroll-driven CSS. DM Sans now loads as one variable font, not four
  weights. next.config: fewer image sizes, WebP only, month-long cache (free-tier transformation
  quotas), long cache for /media.
- Lighthouse measured 86-90 after this and looked like a regression. Checked properly: rebuilt the
  previous commit on the same machine and it also scored 89-91 (the machine got slower since the
  93-94 reading). The real cost found on the way: keyframes on individual transform properties
  repainted every frame; moved to `transform`, paint per load 248 ms -> ~95 ms. Also found a
  leftover in-memory test database still running from an earlier E2E run; stopped it.
- "Open to offers" search filter and band label; offers waiting on you count in the inbox badge
  ("Things to answer"); the agreed price pops in once.

### 2026-10-27: formats, deals, saves, event requests, new brand

- **Ticket formats:** wristband, paper, QR e-ticket, email, app transfer, pass or lanyard, token
  or coupon, other. Old `digital` rows became `qr`; old links and forms with `digital` still work.
  A constraint (`ticket_listings_handover_fits_format`, `NOT VALID`) ties physical formats to
  in-person handover and `app` to digital transfer. The quick listing form omits handover and the
  server picks `defaultHandover(format)`.
- **Multi-ticket deal:** optional `bulk_min_quantity` (2-10, not above quantity) and
  `bulk_price_paise` (below the asking price), both or neither. Sellers can edit them; a
  restricted seller can't. Buyers see the per-ticket deal price once they pick enough tickets.
- **Saved listings:** `saved_listings` table with RLS (own rows only; insert only for active
  listings you can see that aren't yours). 100 per user, rate limit `save` 120/hour, analytics
  event `listing_saved`, "Saved" filter on `/tickets`.
- **Price tiers and good-deal alert** (`src/lib/deal.ts`): steal, good, fair, high, steep against
  face value, or the median of live listings of the same ticket type when there are at least 3.
  "What I paid" is never used. "Good deals" filter on `/tickets`.
- **Events and resale rules:** students only see events that are `allowed` or `face_value_only`.
  New events default to `allowed`; restrictions and the policy source are optional and set by
  moderators in a collapsed section of the admin event form. Resale-policy pills and panels were
  removed from student pages.
- **Event requests:** students can add a missing event (name, start, venue, kind, details) from
  `/sell` or `/events`. Moderators see them in `/admin/events` and can "Approve & publish"
  (creates the event as sent, resale allowed, with a "General" ticket type, logged as
  `create_event`), "Edit first" (prefilled new-event form that links the request on save) or
  "Decline". The nav shows a count of open requests.
- **Brand and design:** new wordmark logo (Bricolage Grotesque 800, tilted ticket as the dot of
  the i), no monogram, lone-ticket favicon, Bricolage for headings and DM Sans for body. Ticket
  cards draw each format as its own shape. Deep-green buy button. `MotionRoot` reveals sections in
  every browser; the tape strip is a ticker. Details in docs/DESIGN.md.
- **Watermark:** `scripts/watermark.ts` now composites the wordmark image
  (`scripts/assets/watermark.png`) bottom-right; `stamp: false` makes clean copies, used for video
  posters. Photo captions were removed from the landing page.
- **Copy** no longer names a college or an email domain in student-facing text.
- **Forms:** the listing form is three steps (event, kind of ticket, how many and price) with
  collapsed optional sections. The buy box is a quantity stepper with a live total and one green
  "Request this ticket" button; note and offer are optional.
- **Private until accepted (WhatsApp handoff):** the core promise. Nobody's number is visible
  while listing or asking. When a seller accepts, the seller gets "WhatsApp {buyer}" and the buyer
  gets "WhatsApp {seller}", each opening a chat with a written first message (tickets, event, the
  agreed or deal price with total, a next step that fits the ticket format) signed "Sent via
  ResTix". Buyers choose on the request whether the seller gets their number and can add one
  there. Migration `20261027080000_whatsapp_handoff.sql`. The "share in your WhatsApp groups"
  link was removed. The promise is stated in the hero, tagline, ticker, safety tiles, how it
  works, FAQ, sign-in and sell pages.
- **Event posters and covers:** moderators can upload a cover in the event form (shrunk in the
  browser, re-encoded and checked on the server, stored in `event_covers`). Events show as
  posters: the cover when there is one, otherwise a bold gradient in the event's colour with
  the kind of event set large, a date stub, and a green "tickets from ₹" chip. The event page
  opens with a full-width poster; listing pages carry the cover as a banner. Migration
  `20261027090000_event_covers.sql`.
- Tests added: `src/lib/deal.test.ts`, `tests/integration/formats-deals-saves.test.ts`,
  `tests/integration/covers.test.ts`,
  `tests/integration/handoff.test.ts`, new cases in `src/lib/whatsapp.test.ts`,
  `src/lib/validation.test.ts`, `tests/integration/suggestions.test.ts`, `tests/integration/rls.test.ts`,
  `tests/e2e/access.spec.ts` and `tests/e2e/bargain.spec.ts`.

### 2026-10-27 (later): speed, debugging, wants, trust, price drops

- **Debugging:** a crawler signs in as a visitor, buyer, seller and admin and follows every
  same-site link, recording server errors, console errors and phone-width overflow. Fixed: the
  sign-in page and the admin audit table ran off phone screens; very long unbroken event names
  pushed titles off screen. Worst-case data (120-character names, Hindi and emoji, ₹1,00,000,
  10 tickets, long notes) was loaded into the dev database and checked on phone screenshots.
  Found that `.env.local` let the dev server open 4 connections to the single-session local
  database, which interleaves queries ("portal does not exist") and can hang requests; local
  `DB_POOL_MAX` is now 1 and `.env.example` says why.
- **Speed:** zod no longer ships to the browser (the report form imported the validation module;
  report reasons moved to `src/lib/report-reasons.ts`), cutting about 120 KB from listing pages.
  `(app)/loading.tsx` shows a skeleton the moment someone navigates and lets Next prefetch up to
  it; measured on a production build, the URL changes in about 50 ms after a click. Trade-off:
  inside the signed-in app a missing listing or event now answers 200 (the skeleton has already
  streamed) with the not-found page and a `noindex` tag; public missing pages still return 404. The sidebar
  and the filter menu use small dedicated queries (`nextUpEvent`, `eventOptions`) instead of the
  full event list, and the browse counts skip the going-rate calculation unless "Good deals" is on.
  Page titles use the display font.
- **Features:** "I want a ticket" on event pages (counts shown on posters and to sellers in the
  sell form; never names), seller track record on listings (handovers confirmed by both sides,
  typical reply time), price-drop badges ("↓ was ₹X" for a week), and "More for this event" on
  listing pages. Admin ticket types are now an editor with one-tap presets and a row per type.
- **Bargaining:** on by default for new listings (sellers can untick it). It stays out of the
  way until wanted: buyers see "Don't like the price? Make an offer", sellers "Counter offer".
- **WhatsApp numbers:** fields show a fixed +91; numbers from abroad still work with their own +code.
- Tests added: `tests/integration/signals.test.ts`; e2e updates in `journey.spec.ts` and
  `bargain.spec.ts`.
