# Database

Postgres. Source of truth: `supabase/migrations/*.sql`, applied in filename order by
`scripts/migrate.ts` (tracked in `restix_meta.migrations`). Everything lives in schema `restix`.

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `colleges` | One row per institution | Multi-college ready |
| `college_email_domains` | Domain -> college | A domain must ALSO be in `ALLOWED_EMAIL_DOMAINS` to sign in |
| `profiles` | Public profile: display name, college, `email_verified_at`, status | PK = `auth.users.id` (cascade delete) |
| `profile_private` | Email, optional WhatsApp | Owner and moderators only |
| `admin_roles` | `moderator` / `admin` | Written by admins or `scripts/grant-role.ts` |
| `events` | Event, schedule, status, **transfer policy** + source | `is_fixture` marks sample data |
| `ticket_types` | Per-event ticket types with face value | |
| `ticket_listings` | The listing: format, quantity, prices (paise), handover, status, expiry, `version` | |
| `inquiries` | Buyer -> seller request; `seller_contact_shared` on accept | `seller_id` denormalised for RLS |
| `transaction_confirmations` | Each party's private outcome | one per party per inquiry |
| `reports` | Reports with a snapshot of the listing at report time | priority set by trigger |
| `moderation_actions` | Append-only audit log | no update/delete grants |
| `appeals` | Appeals against moderation | |
| `analytics_events` | First-party events | purged after 18 months |
| `rate_limits` | Fixed-window counters | no client access |

## Constraints worth knowing

- Prices: integer paise, 0 to 10,000,000 (Rs 1,00,000). Quantity 1-10.
- Listing statuses: `draft, pending_review, active, paused, sold, unavailable, expired, removed, rejected`.
- `inquiries_one_open`: unique (listing, buyer) while pending/accepted.
- `reports_one_open_listing` / `_user`: one open report per reporter per target.
- `appeals_one_open`: one open appeal per user per moderation action.
- Events: `ends_at > starts_at`; unique `(college_id, slug)`.

## Row-level security

All tables have RLS enabled. Policies use helper functions (SECURITY DEFINER, fixed
`search_path`): `is_moderator()`, `is_admin()`, `is_eligible()` (verified + active),
`can_browse()` (verified + not suspended), `my_college_id()`, `profile_status_reason(uuid)`.

| Table | Read | Write |
| --- | --- | --- |
| profiles | any signed-in user, **public columns only** (column grants) | self: `display_name`; moderators: `status`, `status_reason` (trigger blocks self-status changes) |
| profile_private | owner, moderators | owner: `whatsapp_number` |
| events / ticket_types | same college / any | moderators |
| ticket_listings | owner always; moderators; browsers of the same college for public statuses | insert: eligible owner; update: owner (columns granted) or moderator; delete: owner |
| inquiries | buyer, seller, moderators | insert: eligible buyer on an active listing, matching seller; update: parties, moderators (trigger limits who sets what) |
| transaction_confirmations | parties, moderators | the party, once, after acceptance |
| reports | reporter, moderators | insert: eligible reporter, `open` only; update: moderators |
| moderation_actions | moderators | insert: moderator as themselves; never update/delete |
| appeals | owner, moderators | insert: owner; update: moderators |
| analytics_events | admins | server only |
| rate_limits | none | server only (via `hit_rate_limit`) |

## Guard triggers

- `guard_listing_update`: seller, event and creation time are immutable; `version` must increase
  by exactly one; non-moderators can't set `removed`/`rejected`, restore a removed listing,
  publish from review, or touch review fields.
- `guard_listing_insert`: new listings start as draft/pending/active only.
- `guard_inquiry_update`: content immutable; buyers may only withdraw; sellers may only
  accept/decline/close; withdrawn/declined can't reopen.
- `guard_profile_update`: only moderators change status; nobody changes their own status.
- `set_report_priority`: priority comes from the reason.

## Functions

- `hit_rate_limit(bucket, limit, window_seconds)`: atomic counter, returns whether allowed.
- `expire_listings()`: marks overdue open listings expired.
- `purge_old_data()`: analytics > 18 months, stale rate-limit rows, then `expire_listings()`.

## Running migrations

```bash
npm run db            # local PGlite: applies migrations, seeds fixtures on first run
DATABASE_URL=... npm run db:migrate   # any Postgres, including Supabase (use the DIRECT or session connection)
```

Never run `db/local/supabase_shim.sql` against Supabase; it recreates Supabase's own objects for
local use only.

## Tests

`tests/integration/rls.test.ts` attacks these rules directly as authenticated users (forged
seller ids, self-verification, moderator-only statuses, reading private emails, rewriting the
audit log, version skipping, cross-college reads, and more).
