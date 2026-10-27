-- Bargaining. Buyer and seller trade offers on an inquiry until one of them accepts the other's
-- number. ResTix only records the agreed price; money still changes hands between the two people
-- at the handover, never through ResTix.
--
-- Rules, all enforced here rather than trusted from the app:
--   * only the two people in the conversation make or answer offers, while it is open;
--   * one open offer at a time (a new one supersedes the last);
--   * nobody offers above the asking price, and never above face value on face-value events;
--   * a buyer can only open bargaining on a listing marked "open to offers" (a seller can always
--     offer a lower price);
--   * only the other person accepts or declines an offer; only its maker withdraws it;
--   * once a price is agreed, it's set: the inquiry stores it and no more offers are taken.
--
-- Also: the seller's WhatsApp number moves into its own column, so the app can build the chat
-- link (with a ready-written message) when the page is shown instead of freezing it in text.

alter table restix.inquiries
  add column if not exists agreed_price_paise integer check (agreed_price_paise between 100 and 10000000),
  add column if not exists seller_whatsapp text check (seller_whatsapp ~ '^\+[1-9][0-9]{7,14}$');

grant update (seller_whatsapp) on restix.inquiries to authenticated;

create table restix.offers (
  id            uuid primary key default gen_random_uuid(),
  inquiry_id    uuid not null references restix.inquiries(id) on delete cascade,
  from_user     uuid not null references restix.profiles(id) on delete cascade,
  amount_paise  integer not null check (amount_paise between 100 and 10000000),
  status        text not null default 'open'
                  check (status in ('open', 'accepted', 'declined', 'superseded', 'withdrawn')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index offers_inquiry on restix.offers (inquiry_id, created_at);
create unique index offers_one_open on restix.offers (inquiry_id) where status = 'open';

alter table restix.offers enable row level security;

create or replace function restix.is_inquiry_party(p_inquiry uuid) returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (select 1 from restix.inquiries i where i.id = p_inquiry and auth.uid() in (i.buyer_id, i.seller_id));
$$;
grant execute on function restix.is_inquiry_party(uuid) to authenticated;

create or replace function restix.inquiry_college(p_inquiry uuid) returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select restix.listing_college(i.listing_id) from restix.inquiries i where i.id = p_inquiry;
$$;
grant execute on function restix.inquiry_college(uuid) to authenticated;

create policy offers_read on restix.offers for select to authenticated
  using (restix.is_inquiry_party(inquiry_id) or restix.moderates(restix.inquiry_college(inquiry_id)));
create policy offers_insert on restix.offers for insert to authenticated
  with check (from_user = auth.uid() and status = 'open' and decided_at is null
              and restix.is_eligible() and restix.is_inquiry_party(inquiry_id));
create policy offers_update on restix.offers for update to authenticated
  using (restix.is_inquiry_party(inquiry_id)) with check (restix.is_inquiry_party(inquiry_id));

grant select, insert on restix.offers to authenticated;
grant update (status) on restix.offers to authenticated;

-- Checks a new offer against the conversation and the listing, then retires the previous open one.
create or replace function restix.prepare_offer() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  c record;
  v_cap integer;
begin
  select i.status, i.buyer_id, i.seller_id, i.agreed_price_paise,
         l.status as listing_status, l.asking_price_paise, l.original_price_paise, l.price_negotiable,
         e.transfer_policy, t.face_value_paise
    into c
    from restix.inquiries i
    join restix.ticket_listings l on l.id = i.listing_id
    join restix.events e on e.id = l.event_id
    join restix.ticket_types t on t.id = l.ticket_type_id
   where i.id = new.inquiry_id
   for update of i;
  if not found then raise exception 'conversation not found' using errcode = '23503'; end if;

  if auth.uid() is not null and new.from_user <> auth.uid() then
    raise exception 'offers are made in your own name' using errcode = '42501';
  end if;
  if new.from_user not in (c.buyer_id, c.seller_id) then
    raise exception 'only the buyer and seller can make offers' using errcode = '42501';
  end if;
  if c.status not in ('pending', 'accepted') or c.listing_status <> 'active' then
    raise exception 'offer_closed: this conversation is closed' using errcode = '23514';
  end if;
  if c.agreed_price_paise is not null then
    raise exception 'offer_agreed: a price is already agreed' using errcode = '23514';
  end if;
  if new.amount_paise > c.asking_price_paise then
    raise exception 'offer_above_asking: offers cannot be above the asking price' using errcode = '23514';
  end if;
  if c.transfer_policy = 'face_value_only' then
    v_cap := least(coalesce(c.face_value_paise, c.original_price_paise), coalesce(c.original_price_paise, c.face_value_paise));
    if v_cap is not null and new.amount_paise > v_cap then
      raise exception 'offer_above_face: this event only allows resale at face value' using errcode = '23514';
    end if;
  end if;
  if new.from_user = c.buyer_id and not c.price_negotiable
     and not exists (select 1 from restix.offers o where o.inquiry_id = new.inquiry_id and o.from_user = c.seller_id) then
    raise exception 'offer_fixed: this seller is not taking offers' using errcode = '23514';
  end if;

  new.status := 'open';
  new.decided_at := null;
  new.created_at := now();
  update restix.offers set status = 'superseded', decided_at = now()
   where inquiry_id = new.inquiry_id and status = 'open';
  return new;
end $$;

create trigger offers_prepare before insert on restix.offers
  for each row execute function restix.prepare_offer();

-- Who may move an offer out of "open", and to where.
create or replace function restix.guard_offer_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  c record;
begin
  if new.inquiry_id <> old.inquiry_id or new.from_user <> old.from_user
     or new.amount_paise <> old.amount_paise or new.created_at <> old.created_at then
    raise exception 'offers cannot be edited' using errcode = '42501';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'offer_decided: this offer has already been answered' using errcode = '23514';
  end if;
  new.decided_at := now();
  -- Superseding happens inside prepare_offer, one trigger level down.
  if new.status = 'superseded' and pg_trigger_depth() > 1 then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if new.status in ('accepted', 'declined') then
    if auth.uid() = old.from_user then
      raise exception 'you cannot answer your own offer' using errcode = '42501';
    end if;
    select i.status, i.agreed_price_paise into c from restix.inquiries i where i.id = old.inquiry_id;
    if c.status not in ('pending', 'accepted') then
      raise exception 'offer_closed: this conversation is closed' using errcode = '23514';
    end if;
    if new.status = 'accepted' and c.agreed_price_paise is not null then
      raise exception 'offer_agreed: a price is already agreed' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = 'withdrawn' and auth.uid() = old.from_user then
    return new;
  end if;
  raise exception 'that change is not allowed' using errcode = '42501';
end $$;

create trigger offers_guard before update on restix.offers
  for each row execute function restix.guard_offer_update();

-- An accepted offer becomes the conversation's agreed price.
create or replace function restix.apply_accepted_offer() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.status = 'accepted' and old.status = 'open' then
    update restix.inquiries set agreed_price_paise = new.amount_paise where id = new.inquiry_id;
  end if;
  return null;
end $$;

create trigger offers_accepted after update on restix.offers
  for each row execute function restix.apply_accepted_offer();

-- Inquiry guard, extended: the agreed price is only ever set by an accepted offer, and only the
-- seller shares their WhatsApp number.
create or replace function restix.guard_inquiry_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id or new.seller_id <> old.seller_id
     or new.message <> old.message or new.quantity_requested <> old.quantity_requested then
    raise exception 'inquiry content is immutable' using errcode = '42501';
  end if;
  if new.agreed_price_paise is distinct from old.agreed_price_paise and pg_trigger_depth() <= 1 and auth.uid() is not null then
    raise exception 'the agreed price comes from an accepted offer' using errcode = '42501';
  end if;
  if new.buyer_seen_at is distinct from old.buyer_seen_at and auth.uid() is not null and auth.uid() <> old.buyer_id then
    raise exception 'only the buyer marks replies as seen' using errcode = '42501';
  end if;
  if auth.uid() is not null and not restix.moderates(restix.listing_college(old.listing_id)) then
    if auth.uid() = old.buyer_id and auth.uid() <> old.seller_id then
      if new.status <> old.status and new.status <> 'withdrawn' then
        raise exception 'buyers can only withdraw an inquiry' using errcode = '42501';
      end if;
      if new.seller_contact_shared is distinct from old.seller_contact_shared or new.responded_at is distinct from old.responded_at
         or new.seller_whatsapp is distinct from old.seller_whatsapp then
        raise exception 'only the seller responds' using errcode = '42501';
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

-- Analytics: count offers made and accepted (amounts only, no names), and listing shares.
alter table restix.analytics_events drop constraint if exists analytics_events_name_check;
alter table restix.analytics_events add constraint analytics_events_name_check check (name in (
  'landing_viewed', 'search_performed', 'event_viewed', 'listing_viewed',
  'listing_created', 'listing_edited', 'listing_published', 'listing_closed',
  'inquiry_started', 'inquiry_created', 'inquiry_accepted',
  'outcome_confirmed', 'report_submitted', 'report_resolved',
  'email_verified', 'signed_in',
  'offer_made', 'offer_accepted', 'listing_shared'));
