-- More ticket formats, multi-ticket discounts, and saved listings.

-- ---------------------------------------------------------------------------
-- Formats: not every event uses a wristband
-- ---------------------------------------------------------------------------
--   wristband  fabric or silicone band          paper  printed ticket
--   qr         QR e-ticket (PDF or screenshot)  email  booking email / confirmation
--   app        transfer inside a ticketing app  pass   lanyard, pass or entry card
--   token      token, coupon or stamp card      other
-- The old 'digital' value meant a QR e-ticket.

alter table restix.ticket_listings drop constraint if exists ticket_listings_format_check;

-- A data fix, not a seller edit: skip the listing guard (it would demand a version bump and
-- re-check event rules for listings whose events are long over).
alter table restix.ticket_listings disable trigger listings_guard;
update restix.ticket_listings set format = 'qr' where format = 'digital';
alter table restix.ticket_listings enable trigger listings_guard;

alter table restix.ticket_listings add constraint ticket_listings_format_check
  check (format in ('wristband', 'paper', 'qr', 'email', 'app', 'pass', 'token', 'other'));

-- Physical things are handed over in person; an in-app transfer happens in the app. Same pairs as
-- handoversFor() in src/lib/listing-rules.ts.
-- NOT VALID: enforced for every new or changed row, without failing on older data.
alter table restix.ticket_listings add constraint ticket_listings_handover_fits_format check (
  case
    when format in ('wristband', 'paper', 'pass', 'token') then handover_method = 'in_person'
    when format = 'app' then handover_method = 'digital_transfer'
    else true
  end
) not valid;

-- ---------------------------------------------------------------------------
-- Multi-ticket discount: "₹X each if you take N or more"
-- ---------------------------------------------------------------------------

alter table restix.ticket_listings
  add column bulk_min_quantity smallint,
  add column bulk_price_paise integer;

-- Both or neither; the threshold fits the listing; the deal is a real discount. Below the asking
-- price also keeps it under any face-value cap, which the asking price already respects.
-- (Spelled out with "is not null": a CHECK that comes out NULL counts as passing.)
alter table restix.ticket_listings add constraint ticket_listings_bulk_check check (
  (bulk_min_quantity is null and bulk_price_paise is null)
  or (bulk_min_quantity is not null and bulk_price_paise is not null
      and bulk_min_quantity between 2 and 10
      and bulk_min_quantity <= quantity
      and bulk_price_paise between 0 and 10000000
      and bulk_price_paise < asking_price_paise)
);

grant update (bulk_min_quantity, bulk_price_paise) on restix.ticket_listings to authenticated;

-- Same guard as before (20261027020000_hardening.sql), with the discount columns counted as
-- listing details that a restricted seller can't change.
create or replace function restix.guard_listing_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  v_mod boolean := auth.uid() is null or restix.moderates(restix.event_college(old.event_id));
begin
  if new.seller_id <> old.seller_id or new.event_id <> old.event_id or new.created_at <> old.created_at then
    raise exception 'listing ownership, event and creation time are immutable' using errcode = '42501';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'listing version must increase by exactly one' using errcode = '40001';
  end if;

  if not v_mod then
    if new.status in ('removed', 'rejected') and new.status <> old.status then
      raise exception 'only moderators can remove or reject listings' using errcode = '42501';
    end if;
    if old.status in ('removed', 'sold', 'unavailable', 'expired') and new.status <> old.status then
      raise exception 'this listing is closed' using errcode = '42501';
    end if;
    if new.status = 'active' and old.status <> 'active' and old.status not in ('draft', 'paused') then
      raise exception 'listings under review or rejected are published by a moderator' using errcode = '42501';
    end if;
    if new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'review fields are set by moderators only' using errcode = '42501';
    end if;
    -- Restricted sellers may only close or pause what they already have.
    if not restix.is_eligible() then
      if new.status not in ('paused', 'sold', 'unavailable', 'draft')
         or (new.ticket_type_id, new.format, new.quantity, new.asking_price_paise, new.original_price_paise,
             new.price_negotiable, new.handover_method, new.meetup_area, new.handover_notes, new.seller_notes,
             new.expires_at, new.bulk_min_quantity, new.bulk_price_paise)
            is distinct from
            (old.ticket_type_id, old.format, old.quantity, old.asking_price_paise, old.original_price_paise,
             old.price_negotiable, old.handover_method, old.meetup_area, old.handover_notes, old.seller_notes,
             old.expires_at, old.bulk_min_quantity, old.bulk_price_paise) then
        raise exception 'restricted accounts can only pause or close listings' using errcode = '42501';
      end if;
    end if;
    if new.status = 'active' and old.status <> 'active' then
      new.published_at := coalesce(old.published_at, now());
    elsif new.published_at is distinct from old.published_at then
      raise exception 'published_at is set by the server' using errcode = '42501';
    end if;
  end if;

  if new.status in ('active', 'pending_review', 'paused') and old.status <> 'expired' then
    perform restix.check_listing_rules(new.event_id, new.ticket_type_id, new.status, new.asking_price_paise,
                                       new.original_price_paise, new.expires_at);
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Saved listings: a private watchlist
-- ---------------------------------------------------------------------------

create table restix.saved_listings (
  user_id     uuid not null references restix.profiles(id) on delete cascade,
  listing_id  uuid not null references restix.ticket_listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saved_listings_listing on restix.saved_listings (listing_id);

alter table restix.saved_listings enable row level security;

-- Your saves are yours alone; sellers never learn who saved their listing.
create policy saved_read on restix.saved_listings for select to authenticated
  using (user_id = auth.uid());
-- Only live listings you can actually see (listing RLS applies inside the subquery), never your own.
create policy saved_insert on restix.saved_listings for insert to authenticated
  with check (
    user_id = auth.uid()
    and restix.can_browse()
    and exists (select 1 from restix.ticket_listings l
                 where l.id = listing_id and l.status = 'active' and l.seller_id <> auth.uid())
  );
create policy saved_delete on restix.saved_listings for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on restix.saved_listings to authenticated;

-- ---------------------------------------------------------------------------
-- Analytics: one more event name
-- ---------------------------------------------------------------------------

alter table restix.analytics_events drop constraint if exists analytics_events_name_check;
alter table restix.analytics_events add constraint analytics_events_name_check check (name in (
  'landing_viewed', 'search_performed', 'event_viewed', 'listing_viewed',
  'listing_created', 'listing_edited', 'listing_published', 'listing_closed',
  'inquiry_started', 'inquiry_created', 'inquiry_accepted',
  'outcome_confirmed', 'report_submitted', 'report_resolved',
  'email_verified', 'signed_in',
  'offer_made', 'offer_accepted', 'listing_shared', 'listing_saved'));
