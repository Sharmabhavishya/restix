-- Security hardening from the review of 2026-10-29. Each item closes a path that the app's own
-- code never takes, but that the database should refuse on its own.

-- 1. A seller can't walk a rejected listing back to live without a moderator: from "rejected"
--    the only moves open to them are editing it (which sends it back to review) or leaving it.
create or replace function restix.guard_listing_rejected() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if auth.uid() is not null and old.status = 'rejected' and new.status not in ('rejected', 'pending_review')
     and not restix.moderates(restix.event_college(old.event_id)) then
    raise exception 'rejected listings go back through a moderator' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists listings_guard_rejected on restix.ticket_listings;
create trigger listings_guard_rejected before update on restix.ticket_listings
  for each row execute function restix.guard_listing_rejected();

-- 2. "No deleting a listing with an open report" never held: the check ran as the seller, and the
--    seller can't see reports made by other people. The check now runs with definer rights.
create or replace function restix.listing_has_open_report(p_listing uuid) returns boolean
language sql stable security definer set search_path = restix, pg_temp as $$
  select exists (select 1 from restix.reports where listing_id = p_listing and status in ('open', 'in_review'));
$$;
revoke all on function restix.listing_has_open_report(uuid) from public;
grant execute on function restix.listing_has_open_report(uuid) to authenticated;

drop policy if exists listings_delete_owner on restix.ticket_listings;
create policy listings_delete_owner on restix.ticket_listings for delete to authenticated
  using (
    seller_id = auth.uid()
    and not exists (select 1 from restix.inquiries i where i.listing_id = ticket_listings.id)
    and not restix.listing_has_open_report(id)
  );

-- 3. A new inquiry starts empty. The agreed price, both WhatsApp numbers and the "seen" stamp are
--    only ever set later, by the accepting steps; a buyer can't plant them on the way in.
create or replace function restix.handoff_buyer_whatsapp() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.buyer_whatsapp := null;
    new.seller_whatsapp := null;
    new.agreed_price_paise := null;
    new.buyer_seen_at := null;
    return new;
  end if;
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.buyer_whatsapp := case when new.buyer_shares_whatsapp
      then (select whatsapp_number from restix.profile_private where user_id = new.buyer_id) end;
  else
    new.buyer_whatsapp := old.buyer_whatsapp;
  end if;
  -- The buyer's choice is made once, when asking.
  new.buyer_shares_whatsapp := old.buyer_shares_whatsapp;
  return new;
end $$;

-- 4. A report has to point at something. (Without this, a report with neither a listing nor a user
--    could carry any snapshot and skip the one-open-report-per-target limits.)
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
  else
    raise exception 'a report needs a listing or an account' using errcode = '23514';
  end if;
  return new;
end $$;

-- 5. Audit entries can only be written for your own college, by an active moderator of it.
drop policy if exists moderation_insert on restix.moderation_actions;
create policy moderation_insert on restix.moderation_actions for insert to authenticated
  with check (
    actor_id = auth.uid()
    and restix.moderates(coalesce(
      restix.user_college(user_id), restix.listing_college(listing_id),
      restix.event_college(event_id), restix.user_college(actor_id)))
  );

-- 6. Housekeeping functions are for the server's own role only, whatever the platform's default
--    grants are.
revoke execute on function restix.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function restix.expire_listings() from public, anon, authenticated;
revoke execute on function restix.purge_old_data() from public, anon, authenticated;

-- 7. An outcome can be recorded for an accepted request, or one that was closed after being
--    accepted. A request closed unanswered (listing sold or removed) was never a handover.
drop policy if exists confirmations_insert on restix.transaction_confirmations;
create policy confirmations_insert on restix.transaction_confirmations for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from restix.inquiries i
                where i.id = inquiry_id
                  and (i.status = 'accepted' or (i.status = 'closed' and i.responded_at is not null))
                  and ((party = 'buyer' and i.buyer_id = auth.uid()) or (party = 'seller' and i.seller_id = auth.uid())))
  );

-- 8. Cover versions only ever go up. The version is part of the cover's address and caches keep
--    covers for a year, so a version must never be reused; a counter owned by the database can't be.
--    (It starts well above any version issued so far.)
create sequence if not exists restix.event_cover_version_seq start 1000000;
grant usage on sequence restix.event_cover_version_seq to authenticated;
