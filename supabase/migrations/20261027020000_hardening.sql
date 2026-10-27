-- Hardening after the security review of 27 Oct 2026.
-- Brings the database's own rules up to the application's, so they hold even if a code
-- path skips an app check or the schema is ever exposed: event resale policy and face value
-- enforced in triggers, college-scoped moderation, safer inserts for inquiries, reports and
-- appeals, no event deletion, and deletes that can't erase conversations or open reports.

-- ---------------------------------------------------------------------------
-- College-scoped roles
-- ---------------------------------------------------------------------------

create or replace function restix.moderates(p_college uuid) returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (
    select 1 from restix.admin_roles r join restix.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and p.status = 'active' and p.college_id = p_college
  );
$$;

create or replace function restix.administers(p_college uuid) returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (
    select 1 from restix.admin_roles r join restix.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = 'admin' and p.status = 'active' and p.college_id = p_college
  );
$$;

create or replace function restix.event_college(p_event uuid) returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select college_id from restix.events where id = p_event;
$$;

create or replace function restix.listing_college(p_listing uuid) returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select e.college_id from restix.ticket_listings l join restix.events e on e.id = l.event_id where l.id = p_listing;
$$;

create or replace function restix.user_college(p_user uuid) returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select college_id from restix.profiles where id = p_user;
$$;

grant execute on function restix.moderates(uuid), restix.administers(uuid), restix.event_college(uuid),
  restix.listing_college(uuid), restix.user_college(uuid) to authenticated;

-- is_moderator() stays as "has any role" for helper use, but no policy below relies on it alone.

-- Reports and the audit log remember which college they belong to.
alter table restix.reports add column if not exists college_id uuid references restix.colleges(id);
update restix.reports r set college_id = p.college_id from restix.profiles p where p.id = r.reporter_id and r.college_id is null;
alter table restix.moderation_actions add column if not exists college_id uuid references restix.colleges(id);
update restix.moderation_actions m set college_id = p.college_id from restix.profiles p
  where p.id = coalesce(m.actor_id, m.user_id) and m.college_id is null;

create or replace function restix.set_moderation_college() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  new.college_id := coalesce(
    restix.user_college(new.user_id),
    restix.listing_college(new.listing_id),
    restix.event_college(new.event_id),
    restix.user_college(new.actor_id)
  );
  return new;
end $$;
drop trigger if exists moderation_college on restix.moderation_actions;
create trigger moderation_college before insert on restix.moderation_actions
  for each row execute function restix.set_moderation_college();

-- ---------------------------------------------------------------------------
-- Listings: policy, face value and transitions enforced in the database
-- ---------------------------------------------------------------------------

-- Raises if a listing in `p_status` would break its event's rules. Shared by insert and update.
create or replace function restix.check_listing_rules(
  p_event uuid, p_ticket_type uuid, p_status text, p_asking integer, p_original integer, p_expires timestamptz
) returns void
language plpgsql stable security definer set search_path = restix, pg_temp as $$
declare
  e record;
  v_face integer;
  v_close timestamptz;
begin
  select * into e from restix.events where id = p_event;
  if not found then raise exception 'event not found' using errcode = '23503'; end if;
  select face_value_paise into v_face from restix.ticket_types where id = p_ticket_type and event_id = p_event;
  if not found then raise exception 'ticket type does not belong to this event' using errcode = '23514'; end if;
  if auth.uid() is not null and e.college_id is distinct from restix.my_college_id() then
    raise exception 'event belongs to another college' using errcode = '42501';
  end if;
  v_close := coalesce(e.ends_at, e.starts_at);
  if p_expires > v_close then raise exception 'listing cannot outlive the event' using errcode = '23514'; end if;

  if p_status in ('active', 'pending_review', 'paused') then
    if e.status not in ('scheduled', 'postponed') or v_close <= now() then
      raise exception 'event is not open for listings' using errcode = '23514';
    end if;
    if e.transfer_policy = 'prohibited' then
      raise exception 'resale is not allowed for this event' using errcode = '23514';
    end if;
    if e.transfer_policy = 'unknown' and p_status = 'active' then
      raise exception 'listings for events with an unconfirmed policy need review' using errcode = '23514';
    end if;
    if e.transfer_policy = 'face_value_only' then
      if p_original is null or p_asking > p_original or (v_face is not null and p_asking > v_face) then
        raise exception 'this event only allows resale at face value' using errcode = '23514';
      end if;
    end if;
  end if;
end $$;

create or replace function restix.guard_listing_insert() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if auth.uid() is not null and not restix.moderates(restix.event_college(new.event_id)) then
    if new.status not in ('draft', 'pending_review', 'active') then
      raise exception 'new listings start as draft, pending review or active' using errcode = '42501';
    end if;
    if new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'review fields are set by moderators only' using errcode = '42501';
    end if;
    if new.status <> 'active' then new.published_at := null; end if;
  end if;
  perform restix.check_listing_rules(new.event_id, new.ticket_type_id, new.status, new.asking_price_paise,
                                     new.original_price_paise, new.expires_at);
  return new;
end $$;

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
             new.expires_at)
            is distinct from
            (old.ticket_type_id, old.format, old.quantity, old.asking_price_paise, old.original_price_paise,
             old.price_negotiable, old.handover_method, old.meetup_area, old.handover_notes, old.seller_notes,
             old.expires_at) then
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

-- Owners may delete only listings nobody has contacted them about and with no open report.
drop policy if exists listings_delete_owner on restix.ticket_listings;
create policy listings_delete_owner on restix.ticket_listings for delete to authenticated
  using (
    seller_id = auth.uid()
    and not exists (select 1 from restix.inquiries i where i.listing_id = ticket_listings.id)
    and not exists (select 1 from restix.reports r where r.listing_id = ticket_listings.id and r.status in ('open', 'in_review'))
  );

drop policy if exists listings_read on restix.ticket_listings;
create policy listings_read on restix.ticket_listings for select to authenticated
  using (
    seller_id = auth.uid()
    or restix.moderates(restix.event_college(event_id))
    or (restix.can_browse()
        and status in ('active', 'paused', 'sold', 'unavailable', 'expired')
        and restix.event_college(event_id) = restix.my_college_id())
  );

drop policy if exists listings_update_owner on restix.ticket_listings;
create policy listings_update_owner on restix.ticket_listings for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid() and restix.can_browse());

drop policy if exists listings_update_mod on restix.ticket_listings;
create policy listings_update_mod on restix.ticket_listings for update to authenticated
  using (restix.moderates(restix.event_college(event_id))) with check (restix.moderates(restix.event_college(event_id)));

-- ---------------------------------------------------------------------------
-- Events and ticket types: college-scoped, never deleted
-- ---------------------------------------------------------------------------

drop policy if exists events_read on restix.events;
create policy events_read on restix.events for select to authenticated
  using (college_id = restix.my_college_id());
drop policy if exists events_write on restix.events;
create policy events_insert on restix.events for insert to authenticated
  with check (restix.moderates(college_id));
create policy events_update on restix.events for update to authenticated
  using (restix.moderates(college_id)) with check (restix.moderates(college_id));
revoke delete on restix.events from authenticated;

drop policy if exists ticket_types_read on restix.ticket_types;
create policy ticket_types_read on restix.ticket_types for select to authenticated
  using (restix.event_college(event_id) = restix.my_college_id());
drop policy if exists ticket_types_write on restix.ticket_types;
create policy ticket_types_insert on restix.ticket_types for insert to authenticated
  with check (restix.moderates(restix.event_college(event_id)));
create policy ticket_types_update on restix.ticket_types for update to authenticated
  using (restix.moderates(restix.event_college(event_id))) with check (restix.moderates(restix.event_college(event_id)));
revoke delete on restix.ticket_types from authenticated;

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_update_mod on restix.profiles;
create policy profiles_update_mod on restix.profiles for update to authenticated
  using (restix.moderates(college_id)) with check (restix.moderates(college_id));

create or replace function restix.guard_profile_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.college_id is distinct from old.college_id or new.email_verified_at is distinct from old.email_verified_at then
    if auth.uid() is not null then
      raise exception 'college and verification are set by the server' using errcode = '42501';
    end if;
  end if;
  if auth.uid() is not null
     and (new.status is distinct from old.status or new.status_reason is distinct from old.status_reason) then
    if new.id = auth.uid() then
      raise exception 'nobody can change their own account status' using errcode = '42501';
    end if;
    if not restix.moderates(old.college_id) then
      raise exception 'only moderators of this college can change account status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop policy if exists profile_private_self on restix.profile_private;
create policy profile_private_self on restix.profile_private for select to authenticated
  using (user_id = auth.uid() or restix.moderates(restix.user_college(user_id)));

drop policy if exists admin_roles_read on restix.admin_roles;
create policy admin_roles_read on restix.admin_roles for select to authenticated
  using (user_id = auth.uid() or restix.moderates(restix.user_college(user_id)));
drop policy if exists admin_roles_write on restix.admin_roles;
create policy admin_roles_write on restix.admin_roles for all to authenticated
  using (restix.administers(restix.user_college(user_id)) and user_id <> auth.uid())
  with check (restix.administers(restix.user_college(user_id)) and user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- Inquiries and confirmations
-- ---------------------------------------------------------------------------

drop policy if exists inquiries_read on restix.inquiries;
create policy inquiries_read on restix.inquiries for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or restix.moderates(restix.listing_college(listing_id)));

drop policy if exists inquiries_insert on restix.inquiries;
create policy inquiries_insert on restix.inquiries for insert to authenticated
  with check (
    buyer_id = auth.uid() and restix.is_eligible()
    and status = 'pending' and seller_contact_shared is null and responded_at is null
    and exists (select 1 from restix.ticket_listings l join restix.events e on e.id = l.event_id
                where l.id = listing_id and l.seller_id = inquiries.seller_id and l.seller_id <> auth.uid()
                  and l.status = 'active' and l.expires_at > now()
                  and e.college_id = restix.my_college_id()
                  and e.status in ('scheduled', 'postponed') and coalesce(e.ends_at, e.starts_at) > now())
  );

drop policy if exists inquiries_update_mod on restix.inquiries;
create policy inquiries_update_mod on restix.inquiries for update to authenticated
  using (restix.moderates(restix.listing_college(listing_id))) with check (restix.moderates(restix.listing_college(listing_id)));

drop policy if exists confirmations_read on restix.transaction_confirmations;
create policy confirmations_read on restix.transaction_confirmations for select to authenticated
  using (
    exists (select 1 from restix.inquiries i where i.id = inquiry_id
            and (i.buyer_id = auth.uid() or i.seller_id = auth.uid()
                 or restix.moderates(restix.listing_college(i.listing_id))))
  );

-- ---------------------------------------------------------------------------
-- Reports: the server builds the snapshot; same-college targets only
-- ---------------------------------------------------------------------------

create or replace function restix.prepare_report() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  l record;
  v_college uuid := coalesce(restix.my_college_id(), restix.user_college(new.reporter_id));
begin
  new.college_id := v_college;
  if new.listing_id is not null then
    select x.*, e.name as event_name, e.college_id as event_college, t.name as type_name, p.display_name as seller_name
      into l
      from restix.ticket_listings x
      join restix.events e on e.id = x.event_id
      join restix.ticket_types t on t.id = x.ticket_type_id
      join restix.profiles p on p.id = x.seller_id
     where x.id = new.listing_id;
    if not found or l.event_college is distinct from v_college then
      raise exception 'listing not found' using errcode = '42501';
    end if;
    if l.seller_id = new.reporter_id then
      raise exception 'you cannot report your own listing' using errcode = '42501';
    end if;
    new.reported_user_id := l.seller_id;
    new.target_snapshot := jsonb_build_object(
      'event', l.event_name, 'ticketType', l.type_name, 'format', l.format, 'askingPricePaise', l.asking_price_paise,
      'quantity', l.quantity, 'status', l.status, 'sellerName', l.seller_name, 'sellerNotes', l.seller_notes);
  elsif new.reported_user_id is not null then
    if restix.user_college(new.reported_user_id) is distinct from v_college or new.reported_user_id = new.reporter_id then
      raise exception 'account not found' using errcode = '42501';
    end if;
    new.target_snapshot := jsonb_build_object('userName',
      (select display_name from restix.profiles where id = new.reported_user_id));
  end if;
  return new;
end $$;
drop trigger if exists reports_prepare on restix.reports;
create trigger reports_prepare before insert on restix.reports
  for each row execute function restix.prepare_report();

drop policy if exists reports_read on restix.reports;
create policy reports_read on restix.reports for select to authenticated
  using (reporter_id = auth.uid() or restix.moderates(college_id));
drop policy if exists reports_update_mod on restix.reports;
create policy reports_update_mod on restix.reports for update to authenticated
  using (restix.moderates(college_id)) with check (restix.moderates(college_id));

drop policy if exists moderation_read on restix.moderation_actions;
create policy moderation_read on restix.moderation_actions for select to authenticated
  using (restix.moderates(college_id));

-- ---------------------------------------------------------------------------
-- Appeals: one open appeal per person; nothing decided on insert
-- ---------------------------------------------------------------------------

-- Users can't read the moderation log, so ownership of an appealed action is checked here.
create or replace function restix.is_action_about_me(p_action uuid) returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (select 1 from restix.moderation_actions where id = p_action and user_id = auth.uid());
$$;
grant execute on function restix.is_action_about_me(uuid) to authenticated;

drop index if exists restix.appeals_one_open;
create unique index appeals_one_open on restix.appeals (user_id) where status = 'open';

drop policy if exists appeals_insert on restix.appeals;
create policy appeals_insert on restix.appeals for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'open' and decided_by is null and decided_at is null and decision_note is null
    and (moderation_action_id is null or restix.is_action_about_me(moderation_action_id))
  );
drop policy if exists appeals_read on restix.appeals;
create policy appeals_read on restix.appeals for select to authenticated
  using (user_id = auth.uid() or restix.moderates(restix.user_college(user_id)));
drop policy if exists appeals_update_mod on restix.appeals;
create policy appeals_update_mod on restix.appeals for update to authenticated
  using (restix.moderates(restix.user_college(user_id)) and user_id <> auth.uid())
  with check (restix.moderates(restix.user_college(user_id)) and user_id <> auth.uid());

-- The last action taken against the caller, for linking an appeal (they can't read the log).
create or replace function restix.my_latest_moderation_action() returns uuid
language sql stable security definer set search_path = restix, pg_temp as $$
  select id from restix.moderation_actions where user_id = auth.uid() order by created_at desc limit 1;
$$;
grant execute on function restix.my_latest_moderation_action() to authenticated;
