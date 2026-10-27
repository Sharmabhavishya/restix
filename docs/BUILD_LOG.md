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
6. Optional: event requests from students (currently moderators add all events).
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
