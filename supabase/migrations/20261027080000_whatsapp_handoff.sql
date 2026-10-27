-- Private until accepted: the WhatsApp handoff.
--
-- Nobody's phone number is visible while listing or asking. When a seller accepts a request,
-- both sides get each other's WhatsApp (if they have one and chose to share it):
--   * the seller's number was already copied into inquiries.seller_whatsapp on accepting;
--   * the buyer's number is copied into inquiries.buyer_whatsapp here, at that same moment, from
--     the buyer's own private profile, and only if the buyer allowed it when asking.
-- Until then the column is empty, and no client can write it (no column grant).

alter table restix.inquiries
  add column buyer_shares_whatsapp boolean not null default true,
  add column buyer_whatsapp text check (buyer_whatsapp ~ '^\+[1-9][0-9]{7,14}$');

create or replace function restix.handoff_buyer_whatsapp() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.buyer_whatsapp := null;
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

create trigger inquiries_whatsapp_handoff before insert or update on restix.inquiries
  for each row execute function restix.handoff_buyer_whatsapp();
