# Security

ResTix holds student identities, private contact details and moderation records, and its
listings involve real money changing hands off-platform. Security is a release blocker.

## Threat model

| Actor | Wants to | Main defences |
| --- | --- | --- |
| Outsider (no campus account) | Get in, scrape students, post listings | Google sign-in + exact domain allowlist on every request; private schema; RLS; no public student data |
| Student with a valid account | Scam buyers, impersonate, spam, inflate prices, harass, evade moderation | Event policy enforcement (app + DB), face-value caps, contact details blocked from public text, rate limits, reports, restrictions, audit log, deletion blocked while reported |
| Buyer | Tamper with inquiries, read others' conversations, forge outcomes | Parties-only RLS, immutable inquiry content, pending-only inserts, one confirmation per party |
| Moderator | Overreach, act on own case, act on another college, erase history | College-scoped policies, no self-moderation, append-only audit log, reasons required, appeals |
| Anyone with the public Supabase key | Use PostgREST to read/write tables | `restix` schema not exposed; RLS + column grants anyway |
| Network/browser attacker | Open redirect, XSS, CSRF, clickjacking, session theft | `safeNext`, React escaping, no raw HTML, Next server-action origin check, CSP, frame-ancestors none, httpOnly cookies |

## Controls in place

**Authentication**
- Google OAuth via Supabase Auth, PKCE, code exchanged server-side (`auth/callback`). Only
  identities whose provider is `google` are accepted.
- Server-side session check uses `supabase.auth.getClaims()` (verifies the JWT signature),
  never `getSession()`.
- Email must be verified (Supabase confirmation AND Google's `email_verified`).
- `ALLOWED_EMAIL_DOMAINS` is the single allowlist, exact domain match (`src/lib/email-domain.ts`),
  re-checked on every request from the session's email. The `hd` hint is not trusted.
- Supabase session cookies are set httpOnly, SameSite=Lax, Secure in production.
- Dev sign-in: HMAC-signed cookie, constant-time compare, 7-day expiry; refused unless
  `AUTH_MODE=dev`, not on Vercel, and not a production build (except an explicit local test flag).

**Authorization (two layers)**
- App: every page calls a `require*` guard; every server action re-reads the viewer and checks
  `writeBlockReason()` or the role. User ids always come from the session.
- Database: private schema, RLS on every table, column-level grants, SECURITY DEFINER helpers
  with fixed `search_path`, guard triggers for immutable fields and status transitions, event
  policy and face-value enforcement, college-scoped moderator powers. See docs/DATABASE.md.
- `asSystem` (RLS bypass) is limited to: profile creation at sign-in, the viewer lookup,
  analytics, rate limits, maintenance, the landing page's aggregate counts, onboarding and
  deleting one's own account.

**Input and output**
- zod validation on every action; control characters stripped; lengths bounded in DB checks.
- Parameterised SQL only (postgres tagged templates); LIKE patterns escaped.
- No `dangerouslySetInnerHTML`. The only user-supplied link is a strict `https://wa.me/<digits>`
  match; everything else renders as text.
- Public listing text cannot contain phone numbers, emails or social links.
- Redirects from user input go through `safeNext` (same-site paths only, re-checked after
  normalisation).

**Abuse**
- Postgres-backed rate limits on listing creation/edits, inquiries (burst + daily), responses,
  reports, appeals, profile edits, moderation actions, dev sign-in and analytics beacons
  (per account, and per IP for anonymous traffic).
- One open inquiry per buyer per listing; one open report per reporter per target; one open
  appeal per person.

**Headers**
CSP (`default-src 'self'`, no objects, no framing, restricted form targets), X-Frame-Options
DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS when served over HTTPS,
`X-Powered-By` removed.

**Privacy**
Emails and WhatsApp numbers live in `profile_private` (owner + moderators of that college).
Status reasons are owner/moderator only. Analytics hold no IPs, search text or names. Logs
record error messages, not personal data.

## Security review (27 Oct 2026)

An independent read-only review (separate agent) found the issues below. All are fixed and have
regression tests (`tests/integration/hardening.test.ts`, `review-fixes.test.ts`,
`src/lib/safe-redirect.test.ts`, `tests/e2e/access.spec.ts`).

| Severity | Finding | Fix |
| --- | --- | --- |
| High | Open redirect: `/sign-in?next=/.//evil.com` normalised to `//evil.com` | `safeNext` re-checks the normalised path |
| Medium | Face-value cap trusted the seller's stated original price | Cap also uses the ticket type's published face value (app + trigger) |
| Medium | Appeals never linked to the decision (log unreadable by users); duplicate open appeals possible | `my_latest_moderation_action()` definer function; unique open appeal per user |
| Medium | Rejected listing could be republished straight to live | Republishing goes to review (app); trigger blocks rejected/closed -> active |
| Medium | DB rules weaker than app rules (policy bypass on direct insert, pre-accepted inquiries, forged report snapshots, pre-decided appeals, deleting contacted listings, event deletion) | Hardening migration: rule-checking triggers, stricter insert policies, server-built snapshots, delete limits, no event deletes |
| Medium | Moderators not scoped to a college | `moderates(college)` in every moderator policy |
| Low | Moderator approval could apply to a version they hadn't seen | Version check on approve/reject/hide/remove |
| Low | Analytics beacon flooding (no Origin, rotating anon ids, free-text props) | Same-origin required, per-IP limit, props allowlist |
| Low | Account deletion could escape open reports | Blocked while reports are open |
| Low | Any Supabase provider accepted | Google only, checked in callback and on every request |
| Low | Supabase cookies not httpOnly; no CSP | Both added |
| Low | Restricted sellers couldn't close listings; their listings stayed contactable | Restricted sellers may pause/close; restriction pauses live listings |
| Low | Reports about other colleges' users | Same-college check in the report trigger |
| Info | Unbounded analytics date range | Capped at 366 days |
| Info | `.env.example` ignored by git | Re-included |

## Remaining risks (accepted or out of scope)

- **CSP allows inline scripts.** Next.js hydration needs a per-request nonce to drop
  `'unsafe-inline'`; not done yet. XSS risk is low (no raw HTML, React escaping) but this is the
  first header to tighten.
- **Off-platform fraud.** ResTix cannot verify tickets, prevent payment scams, or recover money.
  The UI says so repeatedly; moderation is after the fact.
- **Institutional account compromise.** A stolen campus Google account is a valid account until
  its session expires. Configure a Supabase session time-box where available.
- **Leaving the institution.** Access ends when the Google account is disabled and the session
  expires; there is no enrolment check (none was provided).
- **Analytics counts are approximate** and self-reported outcomes can be gamed by colluding users.
- **Multi-college analytics are deployment-wide** (admins of any college see all colleges'
  aggregate analytics); run one deployment per college or add scoping before onboarding a second.
- **Free hosting tiers** have no automatic backups (Supabase Free) and may pause; see DEPLOYMENT.md.
- **Real Google sign-in has not been exercised end to end** in this build (no credentials).

## Reporting a vulnerability

Contact the ResTix maintainers privately (see the sign-in page of the deployment). Please don't
open public issues for security problems.
