# Architecture

ResTix is one Next.js app talking to one Postgres database. No microservices, no queues,
no payment provider. It is meant to be maintainable by one student developer.

```
Browser ──> Next.js 16 (App Router, server components + server actions)
              │  src/proxy.ts      refresh Supabase session cookie, anon analytics id
              │  src/server/*      the only code that touches the database
              ▼
            Postgres (Supabase in production, PGlite locally)
              schema `restix` (not exposed through Supabase's Data API)
              RLS policies + grants + guard triggers
            Supabase Auth (Google OAuth) ── identity only
```

## Layers

| Layer | Where | Responsibility |
| --- | --- | --- |
| Pure rules | `src/lib/*` | Validation (zod), listing lifecycle and publish decisions, money, dates (IST), safe redirects, filters. Unit tested, no I/O. |
| Server modules | `src/server/*` | Every database read/write. Each function takes the acting user's id and runs inside `asUser()` (RLS applies) or, for a few documented cases, `asSystem()`. |
| Auth | `src/server/auth/*` | Identity from Supabase (`getClaims()`, signature-verified) or the dev cookie; `completeSignIn` applies the institutional rules; `getViewer` re-checks domain and status on every request; `require*` guards for pages; `writeBlockReason` for actions. |
| Actions & routes | `src/app/**/actions.ts`, `src/app/api/*` | Parse input, call `getViewer()`, refuse if not allowed, call a server module, revalidate. They never trust ids, roles, prices or statuses from the client. |
| Pages | `src/app/**/page.tsx` | Server components. Call a `require*` guard first, then server modules. |
| UI | `src/components/*` | Design tokens in `globals.css`, primitives (`ui/`), the wristband strip, shell, charts. |

## Key decisions

1. **Private schema + RLS as defence in depth.** Supabase exposes `public` through PostgREST to
   anyone holding the publishable key. ResTix keeps every table in `restix`, which is not
   exposed, and the server connects to Postgres directly. User-scoped queries still run as the
   `authenticated` role with the user's id in `request.jwt.claims`, so a missing check in app
   code is caught by RLS. See docs/DATABASE.md.
2. **One driver everywhere.** Local development and tests use PGlite (Postgres 18 compiled to
   WASM) served over the wire protocol by pglite-socket, so the same `postgres` driver and the
   same migrations run locally, in tests and in production. No Docker needed.
3. **Classic dynamic rendering.** Next 16 enables Cache Components by default; nearly every
   ResTix page depends on who is signed in, so it is turned off (`next.config.ts`) for simpler,
   predictable rendering. Public legal pages are prerendered.
4. **Server actions over an API.** Forms post to server actions (Next checks the Origin header);
   they work without JavaScript and use `useActionState` for errors.
5. **Optimistic concurrency.** Every listing write names the `version` it read; the database
   trigger requires `version = old.version + 1`, and the update matches `where version = $read`.
   A stale tab gets "this listing changed since you opened it".
6. **Effective status on read.** A listing's stored status can lag behind time (expiry, a
   cancelled event). Every read derives the status people see (`effectiveStatus`), and search
   only returns rows matching one shared SQL predicate. A daily job tidies stored statuses.
7. **Contact without chat.** Inquiries are requests; the seller accepts and chooses what to share.
   No public phone numbers, no messaging system to moderate.
8. **No evidence uploads (yet).** Not needed for the workflow and avoids storing images of
   tickets or receipts. If added, use a private Supabase Storage bucket with signed URLs.

## Request lifecycle (example: sending an inquiry)

1. The form in `listings/[id]/listing-panels.tsx` posts to `contactSeller` (server action).
2. `contactSeller` calls `getViewer()`; `writeBlockReason` refuses restricted/suspended/unverified.
3. `inquiryInput` (zod) validates the message and quantity.
4. `sendInquiry` checks rate limits (burst + daily), loads the listing as the user (RLS),
   rejects own/unavailable listings, inserts as the user. RLS re-checks eligibility, that the
   listing is active, not the buyer's own, and that `seller_id` matches the listing.
5. A unique partial index blocks a second open inquiry; the error becomes a friendly message.
6. `track("inquiry_created")` records the analytics event; the page revalidates.

## Directory map

```
supabase/migrations/   schema, RLS, grants, triggers, functions (source of truth)
db/local/              Supabase shim for PGlite (roles, auth.users, auth.uid())
scripts/               local-db, migrate, seed, grant-role, add-college
src/lib/               pure rules and helpers (+ unit tests)
src/server/            database access, auth, analytics, metrics
src/app/(app)/         signed-in pages (tickets, events, listings, sell, selling, inquiries, account, admin)
src/app/               landing, sign-in, welcome, legal pages, auth callback, api routes
src/components/        UI primitives, wristband, shell, charts
tests/integration/     RLS attacks and server flows against PGlite
tests/e2e/             Playwright against the production build
```
