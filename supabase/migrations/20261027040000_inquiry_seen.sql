-- Lets buyers see when a seller has answered: the nav shows replies they haven't opened yet.
alter table restix.inquiries add column if not exists buyer_seen_at timestamptz;

grant update (buyer_seen_at) on restix.inquiries to authenticated;

-- Buyers may stamp buyer_seen_at on their own inquiries; nobody else may touch it, and the
-- existing rules for everything else still apply.
create or replace function restix.guard_inquiry_update() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id or new.seller_id <> old.seller_id
     or new.message <> old.message or new.quantity_requested <> old.quantity_requested then
    raise exception 'inquiry content is immutable' using errcode = '42501';
  end if;
  if new.buyer_seen_at is distinct from old.buyer_seen_at and auth.uid() is not null and auth.uid() <> old.buyer_id then
    raise exception 'only the buyer marks replies as seen' using errcode = '42501';
  end if;
  if auth.uid() is not null and not restix.moderates(restix.listing_college(old.listing_id)) then
    if auth.uid() = old.buyer_id and auth.uid() <> old.seller_id then
      if new.status <> old.status and new.status <> 'withdrawn' then
        raise exception 'buyers can only withdraw an inquiry' using errcode = '42501';
      end if;
      if new.seller_contact_shared is distinct from old.seller_contact_shared or new.responded_at is distinct from old.responded_at then
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
