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
| `events` | Event, schedule, status, **transfer policy** + source | `is_fixture` marks sample data. `transfer_policy` defaults to `allowed`; the policy source is optional |
| `ticket_types` | Per-event ticket types with face value | |
| `ticket_listings` | The listing: format, quantity, prices (paise), optional multi-ticket deal (`bulk_min_quantity`, `bulk_price_paise`), handover, status, expiry, `version` | |
| `saved_listings` | A student's private watchlist: `user_id`, `listing_id`, `created_at`; PK is both ids | Sellers never learn who saved their listing |
| `event_covers` | One cover image per event: a WebP (max 1.5 MB, made by sharp, metadata stripped), its size, a tiny blurred data-URL placeholder and a version that busts caches | Read: same college. Write: moderators of the event's college. Served by `src/app/event-cover/[id]/route.ts` |
| `event_wants` | "I want a ticket": one row per student per event | Own rows only (read/insert/delete); insert only for events you can see. Counts come from `event_want_counts(uuid[])` (security definer, college-scoped), never names |
| `inquiries` | Buyer -> seller request; on accept the seller shares `seller_whatsapp` (E.164) and/or a `seller_contact_shared` note, and the database copies the buyer's number into `buyer_whatsapp` if `buyer_shares_whatsapp` (chosen when asking); `agreed_price_paise` once an offer is accepted | `seller_id` denormalised for RLS; `buyer_whatsapp` has no column grant and is set only by the `inquiries_whatsapp_handoff` trigger |
| `offers` | Bargaining on an inquiry: who offered how much, and what happened (`open/accepted/declined/superseded/withdrawn`) | one open offer per inquiry; parties (and that college's moderators) read |
| `transaction_confirmations` | Each party's private outcome | one per party per inquiry |
| `reports` | Reports with a snapshot of the listing at report time | priority set by trigger |
| `moderation_actions` | Append-only audit log | no update/delete grants |
| `appeals` | Appeals against moderation | |
| `analytics_events` | First-party events | purged after 18 months |
| `rate_limits` | Fixed-window counters | no client access |
| `event_suggestions` | Students request a missing event (name, `starts_at`, `venue`, `category`, details); moderators approve, edit first, or decline | college set by trigger; private until a moderator approves; a student's request never creates an event itself, approval does (`approveSuggestion` in `src/server/event-admin.ts`) |

## Constraints worth knowing

- Prices: integer paise, 0 to 10,000,000 (Rs 1,00,000). Quantity 1-10.
- Listing statuses: `draft, pending_review, active, paused, sold, unavailable, expired, removed, rejected`.
- `inquiries_one_open`: unique (listing, buyer) while pending/accepted.
- `reports_one_open_listing` / `_user`: one open report per reporter per target.
- `appeals_one_open`: one open appeal per user per moderation action.
- Events: `ends_at > starts_at`; unique `(college_id, slug)`.
- `ticket_listings_format_check`: format is one of `wristband, paper, qr, email, app, pass, token,
  other`. The old value `digital` was migrated to `qr`; the app still accepts `digital` from old
  links and forms and treats it as `qr` (`parseFormat`).
- `ticket_listings_handover_fits_format`: physical formats (`wristband, paper, pass, token`) must
  be `in_person`; `app` must be `digital_transfer`; other formats may use either. Added `NOT VALID`,
  so it applies to every new or changed row and older rows are not checked. The quick listing form
  leaves handover out and the server picks `defaultHandover(format)`.
- `ticket_listings_bulk_check`: `bulk_min_quantity` and `bulk_price_paise` are both set or both
  null. When set: threshold 2-10 and not above `quantity`; price 0 to 10,000,000 and below
  `asking_price_paise`. Written with explicit `is not null` tests because a CHECK that evaluates
  to NULL passes.
- `saved_listings`: the server caps a user at 100 saves (`MAX_SAVED`, not a DB constraint).

## Which events students see

`transfer_policy` still has four values (`allowed, face_value_only, not_allowed, unknown`), but the
app only shows students events that are `allowed` or `face_value_only` (the `resaleOk` filter in
`src/server/events.ts`: event lists, the sell form and the landing page counts). Restrictions are
optional and set by moderators; the database triggers keep enforcing whichever policy an event has.

## Moderator scope

Since the hardening migration, every moderator power is checked with `moderates(college_id)`:
a moderator or admin acts only within their own college (listings via their event, profiles,
events, ticket types, inquiries, reports, the audit log, appeals, roles).

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
| event_suggestions | suggester, moderators of that college | insert: eligible student as themselves, `open` only; update: moderators of that college |
| saved_listings | the user's own rows only | insert: yourself, only while `can_browse()`, and only for an `active` listing you can see that isn't yours; delete: your own rows; no update |

## Guard triggers

- `guard_listing_update`: seller, event and creation time are immutable; `version` must increase
  by exactly one; non-moderators can't set `removed`/`rejected`, restore a removed listing,
  publish from review, or touch review fields.
- `guard_listing_update` also treats `bulk_min_quantity` and `bulk_price_paise` as listing details:
  a restricted seller can't change them (they can still pause or close). Sellers can edit both
  columns (column grant).
- `guard_listing_insert`: new listings start as draft/pending/active only.
- `guard_inquiry_update`: content immutable; buyers may only withdraw; sellers may only
  accept/decline/close; withdrawn/declined can't reopen; only the seller sets `seller_whatsapp`;
  `agreed_price_paise` only changes through an accepted offer (never written directly, no grant).
- `prepare_offer` (before insert on `offers`): the maker is a party and offers in their own
  name; the conversation is open, the listing active and no price agreed yet; the amount is at
  most the asking price and, on face-value events, at most the face value; a buyer can only open
  bargaining on a listing marked "open to offers" (a seller can always offer); the previous open
  offer becomes `superseded`.
- `guard_offer_update`: amounts and makers are immutable; only the other party accepts or
  declines; only the maker withdraws; answered offers stay answered. `apply_accepted_offer`
  copies an accepted amount onto the inquiry.
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

## Signals (migration 20261027100000)

- `event_want_counts(p_events uuid[])`: how many students want each event, for the viewer's college.
- `seller_stats(p_seller uuid)`: handovers both sides confirmed as `completed`, the number of
  answered requests in the last 120 days and their median reply time in minutes. Empty for
  sellers outside the viewer's college. Aggregates only.
- `ticket_listings.previous_price_paise` / `price_dropped_at`: set only by the
  `listings_price_drop` trigger when the asking price goes down (keeping the highest price of
  the past week through a series of cuts), cleared when it goes up, never set on insert. No
  column grant, so clients can't fake a drop. Cards show it for 7 days.
