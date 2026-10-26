-- ResTix initial schema.
--
-- Everything lives in the `restix` schema, which is NOT exposed through Supabase's
-- Data API (PostgREST only serves the schemas listed in Settings > API; keep `restix`
-- off that list). The Next.js server is the only client. It connects as the table
-- owner and, for every user-scoped request, runs inside a transaction with
-- `set local role authenticated` plus the user's id in `request.jwt.claims`, so the
-- row-level security policies below apply as a second line of defence behind the
-- application's own authorization checks.
--
-- Money is stored in paise (integer). Timestamps are timestamptz.

create schema if not exists restix;
revoke all on schema restix from public;
grant usage on schema restix to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function restix.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Colleges and their institutional email domains
-- ---------------------------------------------------------------------------

create table restix.colleges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 120),
  short_name  text not null check (char_length(short_name) between 2 and 20),
  created_at  timestamptz not null default now()
);

-- Maps an email domain to a college. Whether a domain may sign in at all is decided
-- by the ALLOWED_EMAIL_DOMAINS environment variable on the server; this table only
-- says which college a permitted domain belongs to.
create table restix.college_email_domains (
  domain      text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  college_id  uuid not null references restix.colleges(id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table restix.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  college_id         uuid not null references restix.colleges(id),
  display_name       text not null check (char_length(btrim(display_name)) between 2 and 40),
  -- Set by the server only after it has checked, from the auth provider's own data,
  -- that the account's email is verified and belongs to an allowed domain.
  -- This proves control of an institutional mailbox; it does not prove enrolment.
  email_verified_at  timestamptz,
  status             text not null default 'active'
                       check (status in ('active', 'restricted', 'suspended')),
  status_reason      text check (char_length(status_reason) <= 500),
  onboarded_at       timestamptz,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_touch before update on restix.profiles
  for each row execute function restix.touch_updated_at();

-- Users may rename themselves; only moderators (or the server's system connection)
-- change account status. Verification is never client-writable (no column grant).
create or replace function restix.guard_profile_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if auth.uid() is not null
     and (new.status is distinct from old.status or new.status_reason is distinct from old.status_reason)
     and not exists (select 1 from restix.admin_roles where user_id = auth.uid()) then
    raise exception 'only moderators can change account status' using errcode = '42501';
  end if;
  if auth.uid() is not null and new.id = auth.uid()
     and (new.status is distinct from old.status) then
    raise exception 'moderators cannot change their own account status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on restix.profiles
  for each row execute function restix.guard_profile_update();

-- Private profile data: visible to the owner and moderators only.
create table restix.profile_private (
  user_id          uuid primary key references restix.profiles(id) on delete cascade,
  email            text not null,
  whatsapp_number  text check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at       timestamptz not null default now()
);
create trigger profile_private_touch before update on restix.profile_private
  for each row execute function restix.touch_updated_at();

create table restix.admin_roles (
  user_id     uuid primary key references restix.profiles(id) on delete cascade,
  role        text not null check (role in ('moderator', 'admin')),
  granted_by  uuid references restix.profiles(id) on delete set null,
  granted_at  timestamptz not null default now()
);

-- Role and eligibility helpers used by the policies. SECURITY DEFINER so they can
-- read admin_roles/profiles regardless of the caller's own row visibility.
create or replace function restix.is_moderator() returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (select 1 from restix.admin_roles where user_id = auth.uid());
$$;

create or replace function restix.is_admin() returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (select 1 from restix.admin_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function restix.is_eligible() returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (
    select 1 from restix.profiles
    where id = auth.uid() and email_verified_at is not null and status = 'active'
  );
$$;

create or replace function restix.my_college_id() returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select college_id from restix.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Events and ticket types
-- ---------------------------------------------------------------------------

create table restix.events (
  id               uuid primary key default gen_random_uuid(),
  college_id       uuid not null references restix.colleges(id),
  slug             text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name             text not null check (char_length(name) between 2 and 120),
  description      text check (char_length(description) <= 2000),
  category         text not null check (category in ('fest', 'concert', 'party', 'prom', 'workshop', 'sports', 'other')),
  venue            text check (char_length(venue) <= 120),
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  status           text not null default 'scheduled'
                     check (status in ('scheduled', 'postponed', 'cancelled', 'completed')),
  -- Whether tickets for this event may be resold here. 'unknown' means nobody has
  -- confirmed it yet: listings go to moderator review instead of going live.
  transfer_policy  text not null default 'unknown'
                     check (transfer_policy in ('allowed', 'face_value_only', 'prohibited', 'unknown')),
  policy_source    text check (char_length(policy_source) <= 300),
  policy_updated_at timestamptz,
  -- Development/demo data is flagged so the UI can label it and it can never pass as real activity.
  is_fixture       boolean not null default false,
  created_by       uuid references restix.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (college_id, slug),
  check (ends_at is null or ends_at > starts_at)
);
create index events_college_starts on restix.events (college_id, starts_at);
create trigger events_touch before update on restix.events
  for each row execute function restix.touch_updated_at();

create table restix.ticket_types (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references restix.events(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 60),
  face_value_paise  integer check (face_value_paise between 0 and 10000000),
  sort_order        smallint not null default 0,
  unique (event_id, name)
);

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table restix.ticket_listings (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references restix.events(id) on delete cascade,
  ticket_type_id        uuid not null references restix.ticket_types(id),
  seller_id             uuid not null references restix.profiles(id) on delete cascade,
  format                text not null check (format in ('wristband', 'digital', 'paper', 'other')),
  quantity              smallint not null check (quantity between 1 and 10),
  asking_price_paise    integer not null check (asking_price_paise between 0 and 10000000),
  original_price_paise  integer check (original_price_paise between 0 and 10000000),
  price_negotiable      boolean not null default false,
  handover_method       text not null check (handover_method in ('in_person', 'digital_transfer', 'either')),
  meetup_area           text check (char_length(meetup_area) <= 80),
  handover_notes        text check (char_length(handover_notes) <= 500),
  seller_notes          text check (char_length(seller_notes) <= 1000),
  status                text not null default 'draft'
                          check (status in ('draft', 'pending_review', 'active', 'paused', 'sold',
                                            'unavailable', 'expired', 'removed', 'rejected')),
  status_reason         text check (char_length(status_reason) <= 500),
  expires_at            timestamptz not null,
  published_at          timestamptz,
  reviewed_by           uuid references restix.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  -- Optimistic concurrency: every update must name the version it read.
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index listings_event_status on restix.ticket_listings (event_id, status, expires_at);
create index listings_status_created on restix.ticket_listings (status, created_at desc);
create index listings_seller on restix.ticket_listings (seller_id, created_at desc);

-- Columns a seller may never change, and statuses only moderators may set.
create or replace function restix.guard_listing_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.seller_id <> old.seller_id or new.event_id <> old.event_id or new.created_at <> old.created_at then
    raise exception 'listing ownership, event and creation time are immutable' using errcode = '42501';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'listing version must increase by exactly one' using errcode = '40001';
  end if;
  if auth.uid() is not null and not restix.is_moderator() then
    if new.status in ('removed', 'rejected') and new.status <> old.status then
      raise exception 'only moderators can remove or reject listings' using errcode = '42501';
    end if;
    if old.status in ('removed') and new.status <> old.status then
      raise exception 'a removed listing can only be restored by a moderator' using errcode = '42501';
    end if;
    if old.status = 'pending_review' and new.status = 'active' then
      raise exception 'listings under review are published by a moderator' using errcode = '42501';
    end if;
    if new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'review fields are set by moderators only' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger listings_guard before update on restix.ticket_listings
  for each row execute function restix.guard_listing_update();

create or replace function restix.guard_listing_insert() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if auth.uid() is not null and not restix.is_moderator() then
    if new.status not in ('draft', 'pending_review', 'active') then
      raise exception 'new listings start as draft, pending review or active' using errcode = '42501';
    end if;
    if new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'review fields are set by moderators only' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger listings_guard_insert before insert on restix.ticket_listings
  for each row execute function restix.guard_listing_insert();

-- ---------------------------------------------------------------------------
-- Inquiries (buyer -> seller contact requests) and outcome confirmations
-- ---------------------------------------------------------------------------

create table restix.inquiries (
  id                     uuid primary key default gen_random_uuid(),
  listing_id             uuid not null references restix.ticket_listings(id) on delete cascade,
  buyer_id               uuid not null references restix.profiles(id) on delete cascade,
  seller_id              uuid not null references restix.profiles(id) on delete cascade,
  message                text not null check (char_length(btrim(message)) between 10 and 1000),
  quantity_requested     smallint not null check (quantity_requested between 1 and 10),
  status                 text not null default 'pending'
                           check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'closed')),
  -- What the seller chose to share when accepting (e.g. a WhatsApp link). Only the
  -- two parties can read the row.
  seller_contact_shared  text check (char_length(seller_contact_shared) <= 300),
  responded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
-- One open conversation per buyer per listing.
create unique index inquiries_one_open on restix.inquiries (listing_id, buyer_id)
  where status in ('pending', 'accepted');
create index inquiries_seller on restix.inquiries (seller_id, created_at desc);
create index inquiries_buyer on restix.inquiries (buyer_id, created_at desc);
create index inquiries_listing on restix.inquiries (listing_id, created_at);
create trigger inquiries_touch before update on restix.inquiries
  for each row execute function restix.touch_updated_at();

create or replace function restix.guard_inquiry_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id or new.seller_id <> old.seller_id
     or new.message <> old.message or new.quantity_requested <> old.quantity_requested then
    raise exception 'inquiry content is immutable' using errcode = '42501';
  end if;
  if auth.uid() is not null and not restix.is_moderator() then
    if auth.uid() = old.buyer_id and auth.uid() <> old.seller_id then
      if new.status <> old.status and new.status <> 'withdrawn' then
        raise exception 'buyers can only withdraw an inquiry' using errcode = '42501';
      end if;
      if new.seller_contact_shared is distinct from old.seller_contact_shared then
        raise exception 'only the seller shares their contact' using errcode = '42501';
      end if;
    elsif auth.uid() = old.seller_id then
      if new.status <> old.status and new.status not in ('accepted', 'declined', 'closed') then
        raise exception 'sellers can accept, decline or close an inquiry' using errcode = '42501';
      end if;
      if old.status in ('withdrawn', 'declined') and new.status <> old.status then
        raise exception 'a withdrawn or declined inquiry cannot be reopened' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger inquiries_guard before update on restix.inquiries
  for each row execute function restix.guard_inquiry_update();

create table restix.transaction_confirmations (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references restix.inquiries(id) on delete cascade,
  user_id     uuid not null references restix.profiles(id) on delete cascade,
  party       text not null check (party in ('buyer', 'seller')),
  outcome     text not null check (outcome in ('completed', 'not_completed', 'disputed')),
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  unique (inquiry_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Reports, moderation audit log and appeals
-- ---------------------------------------------------------------------------

create table restix.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references restix.profiles(id) on delete set null,
  listing_id        uuid references restix.ticket_listings(id) on delete set null,
  reported_user_id  uuid references restix.profiles(id) on delete set null,
  reason            text not null check (reason in ('scam', 'fake_listing', 'duplicate', 'prohibited_resale',
                                                    'impersonation', 'spam', 'harassment', 'suspicious_behaviour',
                                                    'disputed_handover', 'other')),
  details           text check (char_length(details) <= 2000),
  -- What the listing looked like when reported, so deleting it does not erase the evidence trail.
  target_snapshot   jsonb not null default '{}'::jsonb,
  status            text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  priority          text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  resolution_note   text check (char_length(resolution_note) <= 1000),
  resolved_by       uuid references restix.profiles(id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null or target_snapshot <> '{}'::jsonb)
);
-- A reporter can hold only one open report per listing / per user, which blunts report flooding.
create unique index reports_one_open_listing on restix.reports (reporter_id, listing_id)
  where status in ('open', 'in_review') and listing_id is not null;
create unique index reports_one_open_user on restix.reports (reporter_id, reported_user_id)
  where status in ('open', 'in_review') and listing_id is null and reported_user_id is not null;
create index reports_queue on restix.reports (status, priority, created_at);

-- Priority comes from the reason, never from the reporter.
create or replace function restix.set_report_priority() returns trigger
language plpgsql as $$
begin
  new.priority := case
    when new.reason in ('scam', 'impersonation', 'harassment') then 'high'
    when new.reason in ('disputed_handover', 'prohibited_resale', 'fake_listing', 'suspicious_behaviour') then 'normal'
    else 'low'
  end;
  return new;
end $$;
create trigger reports_priority before insert on restix.reports
  for each row execute function restix.set_report_priority();

-- Append-only audit log. No update or delete grants exist for any client role.
create table restix.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references restix.profiles(id) on delete set null,
  action      text not null check (action in ('approve_listing', 'reject_listing', 'hide_listing', 'restore_listing',
                                              'remove_listing', 'restrict_user', 'suspend_user', 'reinstate_user',
                                              'resolve_report', 'dismiss_report', 'start_review',
                                              'update_event', 'create_event', 'decide_appeal',
                                              'grant_role', 'revoke_role')),
  reason      text not null check (char_length(btrim(reason)) between 3 and 1000),
  listing_id  uuid references restix.ticket_listings(id) on delete set null,
  user_id     uuid references restix.profiles(id) on delete set null,
  report_id   uuid references restix.reports(id) on delete set null,
  event_id    uuid references restix.events(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index moderation_actions_created on restix.moderation_actions (created_at desc);
create index moderation_actions_user on restix.moderation_actions (user_id, created_at desc);

create table restix.appeals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references restix.profiles(id) on delete cascade,
  moderation_action_id  uuid references restix.moderation_actions(id) on delete set null,
  listing_id            uuid references restix.ticket_listings(id) on delete set null,
  message               text not null check (char_length(btrim(message)) between 10 and 2000),
  status                text not null default 'open' check (status in ('open', 'upheld', 'reversed')),
  decision_note         text check (char_length(decision_note) <= 1000),
  decided_by            uuid references restix.profiles(id) on delete set null,
  decided_at            timestamptz,
  created_at            timestamptz not null default now()
);
create unique index appeals_one_open on restix.appeals (user_id, moderation_action_id)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- First-party analytics and rate limiting
-- ---------------------------------------------------------------------------

create table restix.analytics_events (
  id           bigint generated always as identity primary key,
  name         text not null check (name in (
                 'landing_viewed', 'search_performed', 'event_viewed', 'listing_viewed',
                 'listing_created', 'listing_edited', 'listing_published', 'listing_closed',
                 'inquiry_started', 'inquiry_created', 'inquiry_accepted',
                 'outcome_confirmed', 'report_submitted', 'report_resolved',
                 'email_verified', 'signed_in')),
  occurred_at  timestamptz not null default now(),
  user_id      uuid references restix.profiles(id) on delete set null,
  -- Random first-party id for signed-out visitors; never linked to an account.
  anon_id      uuid,
  listing_id   uuid references restix.ticket_listings(id) on delete set null,
  event_id     uuid references restix.events(id) on delete set null,
  props        jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048)
);
create index analytics_name_time on restix.analytics_events (name, occurred_at);
create index analytics_time on restix.analytics_events (occurred_at);
create index analytics_user_time on restix.analytics_events (user_id, occurred_at) where user_id is not null;

create table restix.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 1,
  primary key (bucket, window_start)
);

-- Atomically counts a hit and returns whether the caller is still within the limit.
create or replace function restix.hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into restix.rate_limits as r (bucket, window_start) values (p_bucket, v_window)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

-- Marks overdue listings expired. Reads never rely on this having run (they also
-- compare expires_at with now()); it keeps stored statuses tidy. Schedule it with
-- pg_cron on Supabase, or let the app call it opportunistically.
create or replace function restix.expire_listings() returns integer
language sql security definer set search_path = restix, pg_temp as $$
  with expired as (
    update restix.ticket_listings
       set status = 'expired', version = version + 1
     where status in ('active', 'paused', 'pending_review', 'draft') and expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table restix.colleges                  enable row level security;
alter table restix.college_email_domains     enable row level security;
alter table restix.profiles                  enable row level security;
alter table restix.profile_private           enable row level security;
alter table restix.admin_roles               enable row level security;
alter table restix.events                    enable row level security;
alter table restix.ticket_types              enable row level security;
alter table restix.ticket_listings           enable row level security;
alter table restix.inquiries                 enable row level security;
alter table restix.transaction_confirmations enable row level security;
alter table restix.reports                   enable row level security;
alter table restix.moderation_actions        enable row level security;
alter table restix.appeals                   enable row level security;
alter table restix.analytics_events          enable row level security;
alter table restix.rate_limits               enable row level security;

-- Reference data
create policy colleges_read on restix.colleges for select to authenticated using (true);
create policy domains_read on restix.college_email_domains for select to authenticated using (true);

-- Profiles: any signed-in user may read the public profile columns (column grants
-- below keep it to id, college, display name, verification and status).
create policy profiles_read on restix.profiles for select to authenticated using (true);
create policy profiles_update_self on restix.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_mod on restix.profiles for update to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());

create policy profile_private_self on restix.profile_private for select to authenticated
  using (user_id = auth.uid() or restix.is_moderator());
create policy profile_private_update_self on restix.profile_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy admin_roles_read on restix.admin_roles for select to authenticated
  using (user_id = auth.uid() or restix.is_moderator());
create policy admin_roles_write on restix.admin_roles for all to authenticated
  using (restix.is_admin()) with check (restix.is_admin());

-- Events: readable within the viewer's college; written by moderators.
create policy events_read on restix.events for select to authenticated
  using (college_id = restix.my_college_id() or restix.is_moderator());
create policy events_write on restix.events for all to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());
create policy ticket_types_read on restix.ticket_types for select to authenticated using (true);
create policy ticket_types_write on restix.ticket_types for all to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());

-- Listings: public statuses are visible to eligible users of the same college; owners
-- see their own in every status; moderators see everything.
create policy listings_read on restix.ticket_listings for select to authenticated
  using (
    seller_id = auth.uid()
    or restix.is_moderator()
    or (restix.is_eligible()
        and status in ('active', 'paused', 'sold', 'unavailable', 'expired')
        and exists (select 1 from restix.events e where e.id = event_id and e.college_id = restix.my_college_id()))
  );
create policy listings_insert on restix.ticket_listings for insert to authenticated
  with check (seller_id = auth.uid() and restix.is_eligible());
create policy listings_update_owner on restix.ticket_listings for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid() and restix.is_eligible());
create policy listings_update_mod on restix.ticket_listings for update to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());
create policy listings_delete_owner on restix.ticket_listings for delete to authenticated
  using (seller_id = auth.uid());

-- Inquiries: only the two parties (and moderators) can see one.
create policy inquiries_read on restix.inquiries for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or restix.is_moderator());
create policy inquiries_insert on restix.inquiries for insert to authenticated
  with check (
    buyer_id = auth.uid() and restix.is_eligible()
    and exists (select 1 from restix.ticket_listings l
                where l.id = listing_id and l.seller_id = inquiries.seller_id
                  and l.seller_id <> auth.uid() and l.status = 'active' and l.expires_at > now())
  );
create policy inquiries_update_parties on restix.inquiries for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

create policy confirmations_read on restix.transaction_confirmations for select to authenticated
  using (
    restix.is_moderator()
    or exists (select 1 from restix.inquiries i where i.id = inquiry_id
               and (i.buyer_id = auth.uid() or i.seller_id = auth.uid()))
  );
create policy confirmations_insert on restix.transaction_confirmations for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from restix.inquiries i where i.id = inquiry_id and i.status in ('accepted', 'closed')
                and ((party = 'buyer' and i.buyer_id = auth.uid()) or (party = 'seller' and i.seller_id = auth.uid())))
  );

-- Reports: reporters see their own; moderators see and work the queue.
create policy reports_read on restix.reports for select to authenticated
  using (reporter_id = auth.uid() or restix.is_moderator());
create policy reports_insert on restix.reports for insert to authenticated
  with check (reporter_id = auth.uid() and restix.is_eligible() and status = 'open'
              and resolved_by is null and resolved_at is null);
create policy reports_update_mod on restix.reports for update to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());

create policy moderation_read on restix.moderation_actions for select to authenticated
  using (restix.is_moderator());
create policy moderation_insert on restix.moderation_actions for insert to authenticated
  with check (restix.is_moderator() and actor_id = auth.uid());

create policy appeals_read on restix.appeals for select to authenticated
  using (user_id = auth.uid() or restix.is_moderator());
create policy appeals_insert on restix.appeals for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and decided_by is null);
create policy appeals_update_mod on restix.appeals for update to authenticated
  using (restix.is_moderator()) with check (restix.is_moderator());

-- Analytics rows are written by the server's system connection; only admins read them.
create policy analytics_read on restix.analytics_events for select to authenticated
  using (restix.is_admin());

-- rate_limits: no policies -> no client access (the function is security definer).

-- ---------------------------------------------------------------------------
-- Grants for the `authenticated` role (RLS still applies on top of these)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema restix from public;
revoke all on all functions in schema restix from public;

grant select on restix.colleges, restix.college_email_domains, restix.events, restix.ticket_types to authenticated;
grant insert, update, delete on restix.events, restix.ticket_types to authenticated;

-- Public profile columns only; email lives in profile_private.
grant select (id, college_id, display_name, email_verified_at, status, created_at) on restix.profiles to authenticated;
grant update (display_name) on restix.profiles to authenticated;
-- Moderators change status through the same role; the column grant must allow it,
-- and the profiles_update_mod policy plus the server restrict who can.
grant update (status, status_reason) on restix.profiles to authenticated;

grant select on restix.profile_private to authenticated;
grant update (whatsapp_number) on restix.profile_private to authenticated;

grant select, insert, delete on restix.admin_roles to authenticated;

grant select, insert, delete on restix.ticket_listings to authenticated;
grant update (ticket_type_id, format, quantity, asking_price_paise, original_price_paise, price_negotiable,
              handover_method, meetup_area, handover_notes, seller_notes, status, status_reason,
              expires_at, published_at, reviewed_by, reviewed_at, version)
  on restix.ticket_listings to authenticated;

grant select, insert on restix.inquiries to authenticated;
grant update (status, seller_contact_shared, responded_at) on restix.inquiries to authenticated;

grant select, insert on restix.transaction_confirmations to authenticated;

grant select, insert on restix.reports to authenticated;
grant update (status, priority, resolution_note, resolved_by, resolved_at) on restix.reports to authenticated;

grant select, insert on restix.moderation_actions to authenticated;

grant select, insert on restix.appeals to authenticated;
grant update (status, decision_note, decided_by, decided_at) on restix.appeals to authenticated;

grant select on restix.analytics_events to authenticated;

grant execute on function restix.is_moderator(), restix.is_admin(), restix.is_eligible(), restix.my_college_id()
  to authenticated;
