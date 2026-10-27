-- Three small signals that make the exchange feel alive and trustworthy.
--
-- 1. "I want a ticket": students mark the events they're hunting for. Only counts leave the
--    table (event_want_counts); nobody sees who.
-- 2. Seller track record (seller_stats): handovers both sides confirmed as completed, and how
--    fast the seller usually answers. Aggregates only, for sellers in the viewer's college.
-- 3. Price drops: when a seller lowers the asking price, the old price and the time are kept so
--    cards can say "was ₹X". Set by a trigger only; no client can write them.

-- ---------------------------------------------------------------------------
-- 1. Wants
-- ---------------------------------------------------------------------------

create table restix.event_wants (
  user_id    uuid not null references restix.profiles(id) on delete cascade,
  event_id   uuid not null references restix.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index event_wants_event on restix.event_wants (event_id);

alter table restix.event_wants enable row level security;

create policy event_wants_read on restix.event_wants for select to authenticated
  using (user_id = auth.uid());
-- Only for events you can see (events RLS applies inside the subquery).
create policy event_wants_insert on restix.event_wants for insert to authenticated
  with check (user_id = auth.uid() and restix.can_browse()
              and exists (select 1 from restix.events e where e.id = event_id));
create policy event_wants_delete on restix.event_wants for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on restix.event_wants to authenticated;

create or replace function restix.event_want_counts(p_events uuid[])
returns table (event_id uuid, wants integer)
language sql stable security definer set search_path = restix, pg_temp as $$
  select w.event_id, count(*)::int
  from restix.event_wants w
  join restix.events e on e.id = w.event_id
  where w.event_id = any(p_events) and e.college_id = restix.my_college_id()
  group by w.event_id
$$;

-- ---------------------------------------------------------------------------
-- 2. Seller track record
-- ---------------------------------------------------------------------------

create or replace function restix.seller_stats(p_seller uuid)
returns table (handovers integer, replies integer, median_reply_minutes integer)
language sql stable security definer set search_path = restix, pg_temp as $$
  select
    (select count(*)::int from restix.inquiries i
      where i.seller_id = p_seller
        and exists (select 1 from restix.transaction_confirmations c
                     where c.inquiry_id = i.id and c.party = 'buyer' and c.outcome = 'completed')
        and exists (select 1 from restix.transaction_confirmations c
                     where c.inquiry_id = i.id and c.party = 'seller' and c.outcome = 'completed')),
    r.n,
    r.median
  from (
    select count(*)::int as n,
           (percentile_cont(0.5) within group (order by extract(epoch from i.responded_at - i.created_at)) / 60)::int as median
    from restix.inquiries i
    where i.seller_id = p_seller and i.status in ('accepted', 'declined') and i.responded_at is not null
      and i.created_at > now() - interval '120 days'
  ) r
  where restix.user_college(p_seller) = restix.my_college_id()
$$;

grant execute on function restix.event_want_counts(uuid[]), restix.seller_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Price drops
-- ---------------------------------------------------------------------------

alter table restix.ticket_listings
  add column previous_price_paise integer,
  add column price_dropped_at timestamptz;

create or replace function restix.track_price_drop() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.asking_price_paise < old.asking_price_paise then
    -- Keep the highest recent price, so a series of cuts still shows the full drop.
    new.previous_price_paise := greatest(old.asking_price_paise,
      case when old.price_dropped_at > now() - interval '7 days' then old.previous_price_paise end);
    new.price_dropped_at := now();
  elsif new.asking_price_paise > old.asking_price_paise then
    new.previous_price_paise := null;
    new.price_dropped_at := null;
  else
    new.previous_price_paise := old.previous_price_paise;
    new.price_dropped_at := old.price_dropped_at;
  end if;
  return new;
end $$;

create trigger listings_price_drop before update on restix.ticket_listings
  for each row execute function restix.track_price_drop();

-- New listings never start "dropped".
create or replace function restix.clear_price_drop() returns trigger
language plpgsql as $$
begin
  new.previous_price_paise := null;
  new.price_dropped_at := null;
  return new;
end $$;

create trigger listings_price_drop_insert before insert on restix.ticket_listings
  for each row execute function restix.clear_price_drop();
