-- Fixes from the pre-launch simulation of 2026-11.

-- 1. "Was ₹X" can't be faked. The old price only counts as the "was" price if it had really been
--    the asking price for a day or more. Raising a price and dropping it back an hour later shows no
--    markdown. A series of honest cuts still shows the full drop (the highest price of the past week
--    that was live for a day).
alter table restix.ticket_listings
  add column if not exists price_set_at timestamptz not null default now();

create or replace function restix.track_price_drop() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  v_recent_previous integer := case when old.price_dropped_at > now() - interval '7 days' then old.previous_price_paise end;
begin
  if new.asking_price_paise < old.asking_price_paise then
    new.previous_price_paise := case
      when old.price_set_at <= now() - interval '24 hours' then greatest(old.asking_price_paise, v_recent_previous)
      else v_recent_previous
    end;
    new.price_dropped_at := case when new.previous_price_paise is null then null else now() end;
    new.price_set_at := now();
  elsif new.asking_price_paise > old.asking_price_paise then
    new.previous_price_paise := null;
    new.price_dropped_at := null;
    new.price_set_at := now();
  else
    new.previous_price_paise := old.previous_price_paise;
    new.price_dropped_at := old.price_dropped_at;
    new.price_set_at := old.price_set_at;
  end if;
  return new;
end $$;

-- 2. An outcome can be recorded for an accepted request, or one closed after the seller said yes
--    (they shared contact). A request closed unanswered by a sale or removal was never a handover.
--    (This replaces the rule that looked at responded_at, which closing a listing used to stamp.)
drop policy if exists confirmations_insert on restix.transaction_confirmations;
create policy confirmations_insert on restix.transaction_confirmations for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from restix.inquiries i
                where i.id = inquiry_id
                  and (i.status = 'accepted'
                       or (i.status = 'closed' and (i.seller_whatsapp is not null or i.seller_contact_shared is not null)))
                  and ((party = 'buyer' and i.buyer_id = auth.uid()) or (party = 'seller' and i.seller_id = auth.uid())))
  );
