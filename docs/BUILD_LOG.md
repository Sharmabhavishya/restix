# ResTix build log

Persistent progress for the build described in the master prompt (CampusTix spec, product named
ResTix). Newest entries at the bottom of each section. Update after every milestone.

## Environment (2026-10-27)

- Windows 11, Node 24.22, npm 11.19, git 2.55. No Docker, no local Postgres, no Supabase CLI.
- Next.js 16.4.3 (App Router, Turbopack), React 19.3, Tailwind v4, TypeScript 5.9.
- Local database: PGlite 0.5.10 (Postgres 18 in WASM) served over the wire protocol by
  pglite-socket 0.2.13, so the app uses the same `postgres` driver locally and on Supabase.
- Design skills used: taste-skill (direction dealt, see docs/DESIGN.md). Next 16 docs summarised
  in docs/NEXT16_NOTES.md (by a Sonnet subagent reading node_modules/next/dist/docs).

## Decisions

| Decision | Why |
| --- | --- |
| Name: ResTix | Requested by the owner (spec's working name was CampusTix). |
| App tables in a private `restix` schema | Not exposed through Supabase's Data API, so the public anon key cannot reach them at all. |
| Server connects to Postgres directly; user requests run as `authenticated` with `request.jwt.claims` | RLS applies as a second layer behind app checks; one driver for local, test and production. |
| Cache Components disabled | Nearly every page is per-user; classic dynamic rendering is simpler to maintain. |
| Contact via inquiries; seller chooses to share WhatsApp/contact on accept | No public phone numbers, no chat to maintain. |
| No payment code of any kind | Spec: connect buyers and sellers only. |
| Evidence uploads deferred | Not required for the workflow; avoids storing sensitive ticket images. Documented. |
| Dev sign-in behind AUTH_MODE=dev, refused in production builds and on Vercel | Lets the full app run and be tested without Google credentials. |

## Checklist

P0 Security / data
- [x] Schema, constraints, RLS, grants, guard triggers (supabase/migrations/20261027000000_init.sql)
- [x] Local Supabase shim + PGlite server + migration runner + dev seed
- [x] RLS integration tests (28) passing
- [x] Env validation, exact-domain allowlist, db access layer (asUser / asSystem)
- [ ] Auth: Supabase Google sign-in + callback + sign-out, dev sign-in, proxy session refresh
- [ ] Onboarding (display name), account page, deletion

P1 Core marketplace
- [ ] Event discovery (search, filters, sort, pagination), event detail
- [ ] Listing detail, create/edit/pause/resume/sold/unavailable/delete with version checks
- [ ] Inquiries: send, seller accept (share contact) / decline, buyer withdraw, outcome confirmation

P2 Trust
- [ ] Reports, moderation queue, actions with reasons, audit log, restrictions, appeals
- [ ] Event management (moderators): policy, status, ticket types

P3 Analytics
- [ ] Tracking endpoint + server events, admin dashboard, docs/ANALYTICS.md

P4 Polish
- [ ] Design system components, landing page, responsive + a11y pass, taste-skill inspector
- [ ] E2E tests (Playwright), Lighthouse

P5 Release
- [ ] Docs: README, CLAUDE.md, ARCHITECTURE, DATABASE, SECURITY, ANALYTICS, DEPLOYMENT, TESTING
- [ ] Lint, typecheck, unit, integration, e2e, build, npm audit

## Log

- Scaffolded Next 16 app; installed deps (pinned PGlite pair).
- Wrote init migration; fixed three self-review gaps (profile status self-edit, report priority
  spoofing, seller inquiry status abuse) with guard triggers before testing.
- Unit tests: 61 passing (email domain, money, listing rules, validation).
- Integration (RLS) tests: 28 passing on first run.
