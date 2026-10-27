# ResTix: notes for Claude Code sessions

@AGENTS.md

Campus ticket exchange. Read docs/ARCHITECTURE.md first, docs/BUILD_LOG.md for current state.

## Rules that must not be broken

- **No payment code of any kind** (no gateways, escrow, payouts, fake checkout).
- Every database access goes through `src/server/*`. User actions use `asUser(viewer.id, ...)`
  so RLS applies. `asSystem` is only for: profile creation at sign-in, analytics, rate limits,
  maintenance, the viewer lookup and the landing page's aggregate counts. Justify any new use.
- Server actions and route handlers re-check access with `getViewer()` + `writeBlockReason()`
  (or a role check). Never trust ids, roles, prices, statuses or verification from the client.
- The email-domain rule lives only in `src/lib/email-domain.ts` + `ALLOWED_EMAIL_DOMAINS`.
- Redirects built from user input go through `safeNext()`.
- Public listing text must not contain contact details (`containsContactDetails`).
- Schema changes are new files in `supabase/migrations/` (never edit an applied one in a deployed
  environment). Update docs/DATABASE.md and add RLS tests in tests/integration/rls.test.ts.
- Never present sample data (`events.is_fixture`) as real activity.
- Copy voice: casual Gen Z in product moments, plain and exact for safety, money, rules, errors
  (docs/DESIGN.md).

## Commands

```bash
npm run db         # local Postgres (PGlite) on :54329; --reset via npm run db:reset
npm run dev        # http://localhost:3000, dev sign-in panel on /sign-in
npm test           # unit + integration
npm run typecheck && npm run lint
npm run build && npm run test:e2e
```

## Gotchas

- Next.js 16: `proxy.ts` not middleware; request APIs are async; see docs/NEXT16_NOTES.md.
- The `postgres` driver returns camelCase columns (`transform: toCamel`) in app code, but the
  standalone scripts in `scripts/` use plain snake_case.
- Dates display and parse in IST (`src/lib/format.ts`); never `new Date(datetimeLocalValue)`.
- E2E runs against the last production build; rebuild after code changes.
