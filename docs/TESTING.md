# Testing

Results below are from the last full run on 27 October 2026 (Windows 11, Node 24.22,
Chrome stable). Re-run before relying on them.

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | pass, 0 errors |
| Lint | `npm run lint` | pass, 0 problems |
| Unit tests | `npm run test:unit` | **105 passed** (9 files) |
| Integration tests | `npm run test:integration` | **65 passed** (7 files) |
| Production build | `npm run build` | pass |
| End-to-end + accessibility | `npm run test:e2e` | **28 passed** (desktop 1440x900 + Pixel 7 phone profile) |
| Dependency audit | `npm audit` | 0 vulnerabilities (production and dev) |
| Accessibility (axe, WCAG 2.1 A/AA) | part of E2E | 0 violations on 22 pages |

## What each layer covers

**Unit** (`src/**/*.test.ts`, no I/O)
- Email domain allowlist: exact match, lookalikes (`snu.edu.in.evil.com`, `evilsnu.edu.in`,
  subdomains), malformed addresses, empty or wildcard allowlists rejected.
- Listing rules: effective status (expiry, ended/cancelled events, terminal states), publish
  decisions for every resale policy including the face-value cap, seller action matrix.
- Validation: prices, quantities, formats, contact details in public text, control characters,
  display-name impersonation, WhatsApp normalisation.
- Safe redirects: absolute URLs, protocol-relative, backslash and dot-segment tricks.
- Search filters: untrusted query strings, IST date boundaries. Campus-time parsing and the
  "next up" countdown (campus-calendar days, tonight vs today). Chart scales.
- WhatsApp hand-off: the buyer's opening message (listed vs agreed price), malformed numbers
  never become links, the seller's group-chat post. Offer amounts (optional when asking,
  required when countering, rupees to paise).
- Photo watermark (`scripts/watermark.test.ts`): mark lands bottom-right, the rest of the image
  is untouched, photos are resized, and EXIF (camera, GPS) is stripped.

**Integration** (`tests/integration`, real migrations on PGlite, as authenticated users)
- `rls.test.ts`: forged sellers, unverified/restricted accounts, editing others' listings,
  moderator-only statuses, version skipping (conflicting updates), cross-college reads,
  self-verification, private emails, self-granted roles, inquiry privacy and immutability,
  duplicate inquiries/reports, outcome confirmations, pre-resolved reports, append-only audit
  log, admin-only analytics, rate limiter, expiry, data purge.
- `hardening.test.ts`: policy/face-value enforcement in the DB, cross-event ticket types,
  rejected/closed listings revived, restricted sellers, deleting contacted listings,
  pre-accepted inquiries, forged report snapshots, cross-college reports and moderation,
  pre-decided and duplicate appeals, event deletion, self role changes.
- `flows.test.ts` / `review-fixes.test.ts`: sign-in completion (allowed, lookalike, unverified,
  returning), the full journey through the server modules, event policies, appeals linked to
  decisions, stale moderator approvals, deletion blocked by open reports.
- `offers.test.ts`: bargaining end to end in the server modules, plus the attacks: offering in
  someone else's name, above the asking price or face value, on a fixed-price listing, after a
  price is agreed or the conversation closed; strangers reading or joining; editing an amount;
  accepting your own offer; writing the agreed price directly; a buyer setting the seller's
  WhatsApp number.
- `suggestions.test.ts` / `replies.test.ts`: event suggestions; unseen-reply counts and who may
  mark them seen.

**End-to-end** (`tests/e2e`, Playwright against `next start` with a fresh seeded DB)
- `journey.spec.ts`: moderator creates a real event -> new student signs in and onboards ->
  browses events -> lists a wristband (and is blocked from putting a phone number in public
  text) -> another student finds it and asks (seller's email never shown) -> seller accepts and
  shares a note -> buyer sees it -> seller marks sold (leaves search) -> buyer records the outcome
  -> buyer reports a suspicious listing -> moderator hides it and resolves the report (both in
  the audit log) -> analytics show exactly 1 listing published and 1 request (sample data
  excluded) -> a student is refused moderator pages.
- `bargain.spec.ts`: a seller with WhatsApp lists "open to offers" -> buyer's over-asking offer
  is refused, a lower one goes with the request -> seller counters -> buyer takes it ("Deal") ->
  seller accepts and shares WhatsApp -> the buyer's button opens wa.me with the seller's number
  and a message naming the ticket and the agreed price; the seller's group-chat share link.
- `access.spec.ts`: other domains and lookalikes rejected, unverified email rejected, sign-in
  return path, forged session cookie ignored, sign-out, prohibited/unknown/face-value/cancelled
  event rules, 404s, stale-tab conflict, analytics endpoint input validation and same-origin
  requirement, open-redirect payloads, CSP header and zero CSP violations, cron secret, security
  headers, robots/noindex, keyboard skip link.
- `mobile.spec.ts`: no horizontal scroll on landing and app, menu folds into a sheet and closes
  on navigation.
- `a11y.spec.ts`: axe scans of public, student and moderator pages.

## Lighthouse (measured)

Lighthouse 12.8.2, mobile emulation, headless Chrome, against `next start` on this machine
(local network, so real-world numbers will be somewhat slower):

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` landing (with photos + video) | 93-94 | 100 | 100 | 100 | 3.0-3.1 s | 0 | 50-80 ms |
| `/sign-in` (with video) | 97-98 | 100 | 100 | 63* | 2.3-2.6 s | 0 | 50 ms |
| `/tickets` (signed in) | 97 | 100 | 100 | 63* | 2.5 s | 0 | 50 ms |
| `/events` (signed in) | 98 | 100 | 100 | 63* | 2.4 s | 0 | 40 ms |

\* Private pages send `noindex` on purpose; that is the only SEO deduction.

Re-measured after the logo/motion pass on a busier machine: landing 87-91, sign-in 97, with
accessibility, best practices and SEO still 100. The previous commit, rebuilt and measured in the
same session, scored 89-91, so the drop is the machine, not the change. Lighthouse numbers on a
laptop move by several points between runs; compare like with like.

The landing LCP is now the hero clip's poster image (simulated slow 4G); before the media it was
the headline text at 2.6 s. The clips themselves load after the page's load event and only when
in view, so they don't hold up first paint.

## Not tested (and why)

- **Real Google OAuth through Supabase**: no credentials in this environment. The callback logic
  is unit-reachable through `completeSignIn` (tested), and the provider check is in code; follow
  docs/DEPLOYMENT.md section 5 to verify on a real project.
- **Supabase-specific roles** (`postgres` membership in `authenticated`): verified only against
  the local shim; DEPLOYMENT.md has the SQL check to run once on the real project.
- **Screen readers**: automated axe checks and keyboard tests only; a manual NVDA/VoiceOver pass
  is recommended before launch.
- **Load testing**: not done; expected scale is one campus.
