import "server-only";
import type { ListingStatus } from "@/lib/listing-rules";
import { asUser, pgCode, PG } from "./db";
import { track } from "./analytics";
import { allow } from "./rate-limit";
import { displayStatus, getListing } from "./listings";
import { insertOffer, offerError } from "./offers";

export type InquiryStatus = "pending" | "accepted" | "declined" | "withdrawn" | "closed";
export type Outcome = "completed" | "not_completed" | "disputed";

export interface InquiryRow {
  id: string;
  listingId: string;
  eventId: string;
  role: "buyer" | "seller";
  counterpartName: string;
  counterpartId: string;
  message: string;
  quantityRequested: number;
  status: InquiryStatus;
  sellerContactShared: string | null;
  /** Seller's number in E.164, set only when they chose to share it on accepting. */
  sellerWhatsapp: string | null;
  /** Buyer's number in E.164, filled in by the database only when the seller accepts. */
  buyerWhatsapp: string | null;
  agreedPricePaise: number | null;
  priceNegotiable: boolean;
  createdAt: Date;
  respondedAt: Date | null;
  buyerSeenAt: Date | null;
  eventName: string;
  eventStartsAt: Date;
  ticketTypeName: string;
  format: string;
  askingPricePaise: number;
  bulkMinQuantity: number | null;
  bulkPricePaise: number | null;
  listingStatus: ListingStatus;
  myOutcome: Outcome | null;
  theirOutcome: Outcome | null;
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function sendInquiry(
  viewerId: string,
  input: { listingId: string; quantity: number; message: string; offerPaise?: number | null; shareWhatsapp?: boolean; whatsapp?: string | null },
): Promise<Result> {
  if (!(await allow("inquiryBurst", viewerId)) || !(await allow("inquiry", viewerId))) {
    return { ok: false, error: "You've contacted a lot of sellers in a short time. Please wait a while before sending another." };
  }
  const listing = await getListing(viewerId, input.listingId);
  if (!listing) return { ok: false, error: "This listing isn't available any more." };
  if (listing.sellerId === viewerId) return { ok: false, error: "This is your own listing." };
  if (displayStatus(listing) !== "active") return { ok: false, error: "This listing isn't available any more." };
  if (input.quantity > listing.quantity) {
    return { ok: false, error: `The seller is offering ${listing.quantity} ticket${listing.quantity === 1 ? "" : "s"}.` };
  }
  try {
    await asUser(viewerId, async (tx) => {
      // A new number goes on the buyer's own private profile; the seller sees it only on accepting.
      if (input.whatsapp) await tx`update restix.profile_private set whatsapp_number = ${input.whatsapp} where user_id = ${viewerId}`;
      const [row] = await tx<{ id: string }[]>`
        insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested, buyer_shares_whatsapp)
        values (${listing.id}, ${viewerId}, ${listing.sellerId}, ${input.message}, ${input.quantity}, ${input.shareWhatsapp ?? true})
        returning id`;
      // An opening offer goes in the same transaction: if it breaks a rule, nothing is sent.
      if (input.offerPaise) await insertOffer(tx, viewerId, row.id, input.offerPaise);
    });
    await track("inquiry_created", { userId: viewerId, listingId: listing.id, eventId: listing.eventId, props: { quantity: input.quantity, with_offer: Boolean(input.offerPaise) } });
    if (input.offerPaise) await track("offer_made", { userId: viewerId, listingId: listing.id, props: { amount_paise: input.offerPaise } });
    return { ok: true };
  } catch (err) {
    const why = offerError(err);
    if (why) return { ok: false, error: why };
    if (pgCode(err) === PG.uniqueViolation) return { ok: false, error: "You've already contacted this seller about this listing. Check your inquiries." };
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "This listing isn't available any more." };
    console.error("inquiry failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your message wasn't sent because of a server error. Please try again." };
  }
}

export async function inbox(viewerId: string): Promise<InquiryRow[]> {
  return asUser(viewerId, (tx) => tx<InquiryRow[]>`
    select i.id, i.listing_id, e.id as event_id,
           case when i.seller_id = ${viewerId} then 'seller' else 'buyer' end as role,
           case when i.seller_id = ${viewerId} then b.display_name else s.display_name end as counterpart_name,
           case when i.seller_id = ${viewerId} then i.buyer_id else i.seller_id end as counterpart_id,
           i.message, i.quantity_requested, i.status, i.seller_contact_shared, i.seller_whatsapp, i.buyer_whatsapp, i.agreed_price_paise,
           l.price_negotiable, i.created_at, i.responded_at,
           case when i.buyer_id = ${viewerId} and (i.buyer_seen_at is null or i.buyer_seen_at < i.responded_at) then null else coalesce(i.buyer_seen_at, i.created_at) end as buyer_seen_at,
           e.name as event_name, e.starts_at as event_starts_at, t.name as ticket_type_name, l.format,
           l.asking_price_paise, l.bulk_min_quantity, l.bulk_price_paise,
           case when l.status = 'active' and (l.expires_at <= now() or coalesce(e.ends_at, e.starts_at) <= now()) then 'expired'
                when l.status = 'active' and e.status = 'cancelled' then 'unavailable'
                else l.status end as listing_status,
           (select outcome from restix.transaction_confirmations c where c.inquiry_id = i.id and c.user_id = ${viewerId}) as my_outcome,
           (select outcome from restix.transaction_confirmations c where c.inquiry_id = i.id and c.user_id <> ${viewerId}) as their_outcome
    from restix.inquiries i
    join restix.ticket_listings l on l.id = i.listing_id
    join restix.events e on e.id = l.event_id
    join restix.ticket_types t on t.id = l.ticket_type_id
    join restix.profiles b on b.id = i.buyer_id
    join restix.profiles s on s.id = i.seller_id
    where i.buyer_id = ${viewerId} or i.seller_id = ${viewerId}
    order by (i.status = 'pending' and i.seller_id = ${viewerId}) desc, i.updated_at desc
    limit 200`);
}

/** The viewer's own open inquiry on a listing, if any (to show "you've asked" on the listing page). */
export async function myInquiryFor(viewerId: string, listingId: string) {
  const [row] = await asUser(viewerId, (tx) => tx<{ id: string; status: InquiryStatus; sellerContactShared: string | null }[]>`
    select id, status, seller_contact_shared from restix.inquiries
    where listing_id = ${listingId} and buyer_id = ${viewerId}
    order by created_at desc limit 1`);
  return row ?? null;
}

export async function respondToInquiry(
  viewerId: string,
  input: { inquiryId: string; decision: "accept" | "decline"; shareWhatsapp: boolean; note: string | null },
): Promise<Result> {
  if (!(await allow("respond", viewerId))) return { ok: false, error: "Too many responses in a short time. Wait a few minutes." };
  try {
    const result = await asUser(viewerId, async (tx): Promise<Result & { listingId?: string }> => {
      const [inq] = await tx<{ status: InquiryStatus; sellerId: string; listingId: string; whatsapp: string | null }[]>`
        select i.status, i.seller_id, i.listing_id,
               (select whatsapp_number from restix.profile_private where user_id = ${viewerId}) as whatsapp
        from restix.inquiries i
        where i.id = ${input.inquiryId} for update of i`;
      if (!inq || inq.sellerId !== viewerId) return { ok: false, error: "Inquiry not found." };
      if (inq.status !== "pending") return { ok: false, error: "This inquiry has already been answered or closed." };

      if (input.decision === "decline") {
        await tx`update restix.inquiries set status = 'declined', responded_at = now() where id = ${input.inquiryId}`;
        return { ok: true };
      }
      if (input.shareWhatsapp && !inq.whatsapp) {
        return { ok: false, error: "Add your WhatsApp number on your account page first, or write how to reach you instead." };
      }
      // The number is stored on its own; the chat link and its opening message are built when shown.
      const whatsapp = input.shareWhatsapp ? inq.whatsapp : null;
      if (!whatsapp && !input.note) return { ok: false, error: "Share your WhatsApp or write how the buyer can reach you." };
      await tx`update restix.inquiries
               set status = 'accepted', seller_whatsapp = ${whatsapp}, seller_contact_shared = ${input.note}, responded_at = now()
               where id = ${input.inquiryId}`;
      // Saying yes to a request that's waiting on the buyer's offer means yes to that price too;
      // the offer trigger records it as the agreed price. (The form says so before the tap.)
      await tx`update restix.offers set status = 'accepted'
               where inquiry_id = ${input.inquiryId} and status = 'open' and from_user <> ${viewerId}`;
      return { ok: true, listingId: inq.listingId };
    });
    if (result.ok && input.decision === "accept") {
      await track("inquiry_accepted", { userId: viewerId, listingId: result.listingId ?? null });
    }
    return result.ok ? { ok: true } : result;
  } catch (err) {
    console.error("respond failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error. Please try again." };
  }
}

export async function withdrawInquiry(viewerId: string, inquiryId: string): Promise<Result> {
  const rows = await asUser(viewerId, (tx) => tx`
    update restix.inquiries set status = 'withdrawn'
    where id = ${inquiryId} and buyer_id = ${viewerId} and status in ('pending', 'accepted') returning id`);
  return rows.length ? { ok: true } : { ok: false, error: "This inquiry can't be withdrawn now." };
}

export async function closeInquiry(viewerId: string, inquiryId: string): Promise<Result> {
  const rows = await asUser(viewerId, (tx) => tx`
    update restix.inquiries set status = 'closed'
    where id = ${inquiryId} and seller_id = ${viewerId} and status = 'accepted' returning id`);
  return rows.length ? { ok: true } : { ok: false, error: "This inquiry can't be closed now." };
}

/** Each party may record, once, what happened after they were put in touch. */
export async function confirmOutcome(viewerId: string, input: { inquiryId: string; outcome: Outcome; note: string | null }): Promise<Result> {
  try {
    const party = await asUser(viewerId, async (tx) => {
      const [inq] = await tx<{ buyerId: string; sellerId: string; status: InquiryStatus; listingId: string; respondedAt: Date | null }[]>`
        select buyer_id, seller_id, status, listing_id, responded_at from restix.inquiries where id = ${input.inquiryId}`;
      if (!inq) return null;
      const role = inq.buyerId === viewerId ? "buyer" : inq.sellerId === viewerId ? "seller" : null;
      // "closed" only counts if the seller said yes first; a request that was closed unanswered
      // (listing sold or removed) was never a handover, so it can't add to anyone's track record.
      const accepted = inq.status === "accepted" || (inq.status === "closed" && inq.respondedAt !== null);
      if (!role || !accepted) return null;
      await tx`insert into restix.transaction_confirmations (inquiry_id, user_id, party, outcome, note)
               values (${input.inquiryId}, ${viewerId}, ${role}, ${input.outcome}, ${input.note})`;
      return { role, listingId: inq.listingId };
    });
    if (!party) return { ok: false, error: "You can record an outcome once the seller has shared their contact." };
    await track("outcome_confirmed", { userId: viewerId, listingId: party.listingId, props: { party: party.role, outcome: input.outcome } });
    return {
      ok: true,
      message: input.outcome === "disputed"
        ? "Recorded. If something went wrong, report it so a moderator can look into it."
        : "Thanks, recorded.",
    };
  } catch (err) {
    if (pgCode(err) === PG.uniqueViolation) return { ok: false, error: "You've already recorded an outcome for this one." };
    console.error("confirm outcome failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error. Please try again." };
  }
}

/** Seller replies (accept/decline) the buyer hasn't opened yet. */
export async function unseenReplies(viewerId: string): Promise<number> {
  const [row] = await asUser(viewerId, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n from restix.inquiries
    where buyer_id = ${viewerId} and status in ('accepted', 'declined') and responded_at is not null
      and (buyer_seen_at is null or buyer_seen_at < responded_at)`);
  return row?.n ?? 0;
}

/** Called when the buyer opens their requests: everything answered so far counts as seen. */
export async function markRepliesSeen(viewerId: string): Promise<void> {
  try {
    await asUser(viewerId, (tx) => tx`
      update restix.inquiries set buyer_seen_at = now()
      where buyer_id = ${viewerId} and responded_at is not null
        and (buyer_seen_at is null or buyer_seen_at < responded_at)`);
  } catch (err) {
    console.error("mark seen failed", err instanceof Error ? err.message : err);
  }
}
