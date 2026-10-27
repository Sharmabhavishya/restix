import { describe, expect, it } from "vitest";
import { db, makeListing, makeUser, outcome } from "./helpers";

const inquiries = await import("@/server/inquiries");
const offers = await import("@/server/offers");
const listings = await import("@/server/listings");
const { asSystem, asUser } = db;

const MSG = "Hey, is this still available?";

async function conversation(opts: { negotiable?: boolean; offerPaise?: number } = {}) {
  const seller = await makeUser();
  const buyer = await makeUser();
  const { listingId, eventId, ticketTypeId } = await makeListing(seller.id, { negotiable: opts.negotiable ?? true });
  const sent = await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: MSG, offerPaise: opts.offerPaise });
  const [inq] = await inquiries.inbox(seller.id);
  return { seller, buyer, listingId, eventId, ticketTypeId, sent, inquiryId: inq?.id };
}

const openOffer = async (viewerId: string, inquiryId: string) =>
  (await offers.offersFor(viewerId, [inquiryId])).get(inquiryId)?.find((o) => o.status === "open");

describe("bargaining", () => {
  it("opens with an offer, settles on a counter, and fixes the agreed price", async () => {
    const c = await conversation({ offerPaise: 35000 });
    expect(c.sent).toEqual({ ok: true });
    expect((await openOffer(c.seller.id, c.inquiryId))?.amountPaise).toBe(35000);

    expect(await offers.offersWaiting(c.seller.id)).toBe(1);
    expect(await offers.offersWaiting(c.buyer.id)).toBe(0);

    // The seller counters; the buyer's offer is retired, and only one stays open.
    expect(await offers.makeOffer(c.seller.id, { inquiryId: c.inquiryId, amountPaise: 45000 })).toEqual({ ok: true });
    expect(await offers.offersWaiting(c.seller.id)).toBe(0);
    expect(await offers.offersWaiting(c.buyer.id)).toBe(1);
    const all = (await offers.offersFor(c.buyer.id, [c.inquiryId])).get(c.inquiryId)!;
    expect(all.map((o) => o.status)).toEqual(["superseded", "open"]);

    // You can't accept your own number; the other person can.
    const counter = all[1];
    expect(await offers.decideOffer(c.seller.id, { offerId: counter.id, decision: "accept" })).toMatchObject({ ok: false });
    expect(await offers.decideOffer(c.buyer.id, { offerId: counter.id, decision: "accept" })).toEqual({ ok: true });
    const [buyerView] = await inquiries.inbox(c.buyer.id);
    expect(buyerView.agreedPricePaise).toBe(45000);

    // Once agreed, the price is set.
    expect(await offers.makeOffer(c.buyer.id, { inquiryId: c.inquiryId, amountPaise: 40000 }))
      .toEqual({ ok: false, error: "You've already agreed a price on this one." });
  });

  it("keeps fixed-price listings fixed unless the seller opens the bargaining", async () => {
    const c = await conversation({ negotiable: false });
    expect(await offers.makeOffer(c.buyer.id, { inquiryId: c.inquiryId, amountPaise: 30000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining("isn't taking offers") });
    // Asking with an offer on a fixed listing sends nothing at all.
    const other = await makeUser();
    expect(await inquiries.sendInquiry(other.id, { listingId: c.listingId, quantity: 1, message: MSG, offerPaise: 30000 }))
      .toMatchObject({ ok: false });
    expect(await inquiries.inbox(other.id)).toHaveLength(0);
    // The seller can offer a lower price, and then the buyer can counter.
    expect(await offers.makeOffer(c.seller.id, { inquiryId: c.inquiryId, amountPaise: 45000 })).toEqual({ ok: true });
    expect(await offers.makeOffer(c.buyer.id, { inquiryId: c.inquiryId, amountPaise: 42000 })).toEqual({ ok: true });
  });

  it("never goes above the asking price or the event's face value", async () => {
    const c = await conversation();
    expect(await offers.makeOffer(c.seller.id, { inquiryId: c.inquiryId, amountPaise: 60000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining("above the asking price") });
    await asSystem((tx) => tx`update restix.events set transfer_policy = 'face_value_only' where id = ${c.eventId}`);
    await asSystem((tx) => tx`update restix.ticket_types set face_value_paise = 30000 where id = ${c.ticketTypeId}`);
    expect(await offers.makeOffer(c.buyer.id, { inquiryId: c.inquiryId, amountPaise: 40000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining("face value") });
    expect(await offers.makeOffer(c.buyer.id, { inquiryId: c.inquiryId, amountPaise: 30000 })).toEqual({ ok: true });
  });

  it("keeps strangers out and the rules in the database", async () => {
    const c = await conversation({ offerPaise: 40000 });
    const stranger = await makeUser();
    const offer = (await openOffer(c.buyer.id, c.inquiryId))!;
    // A stranger sees nothing and can't join in.
    expect((await offers.offersFor(stranger.id, [c.inquiryId])).size).toBe(0);
    expect(await outcome(asUser(stranger.id, (tx) => tx`
      insert into restix.offers (inquiry_id, from_user, amount_paise) values (${c.inquiryId}, ${stranger.id}, 100)`))).toBe("42501");
    // Nobody offers in someone else's name, edits an amount, or writes the agreed price directly.
    expect(await outcome(asUser(c.buyer.id, (tx) => tx`
      insert into restix.offers (inquiry_id, from_user, amount_paise) values (${c.inquiryId}, ${c.seller.id}, 100)`))).toBe("42501");
    expect(await outcome(asUser(c.buyer.id, (tx) => tx`
      update restix.offers set amount_paise = 100 where id = ${offer.id}`))).toBe("42501");
    expect(await outcome(asUser(c.buyer.id, (tx) => tx`
      update restix.inquiries set agreed_price_paise = 100 where id = ${c.inquiryId}`))).toBe("42501");
    // Only the maker withdraws; only the other side answers.
    expect(await outcome(asUser(c.seller.id, (tx) => tx`
      update restix.offers set status = 'withdrawn' where id = ${offer.id}`))).toBe("42501");
    expect(await outcome(asUser(c.buyer.id, (tx) => tx`
      update restix.offers set status = 'accepted' where id = ${offer.id}`))).toBe("42501");
    expect(await offers.decideOffer(c.buyer.id, { offerId: offer.id, decision: "withdraw" })).toEqual({ ok: true });
    // Answered offers stay answered.
    expect(await offers.decideOffer(c.seller.id, { offerId: offer.id, decision: "accept" })).toMatchObject({ ok: false });
  });

  it("stops when the conversation closes", async () => {
    const c = await conversation();
    expect(await inquiries.withdrawInquiry(c.buyer.id, c.inquiryId)).toEqual({ ok: true });
    expect(await offers.makeOffer(c.seller.id, { inquiryId: c.inquiryId, amountPaise: 40000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining("closed") });
  });
});

describe("sharing WhatsApp on accept", () => {
  it("stores the seller's number for that buyer only, and only the seller can set it", async () => {
    const c = await conversation();
    await asSystem((tx) => tx`update restix.profile_private set whatsapp_number = '+919876543210' where user_id = ${c.seller.id}`);
    expect(await inquiries.respondToInquiry(c.seller.id, { inquiryId: c.inquiryId, decision: "accept", shareWhatsapp: true, note: null }))
      .toEqual({ ok: true });
    const [buyerView] = await inquiries.inbox(c.buyer.id);
    expect(buyerView.sellerWhatsapp).toBe("+919876543210");
    expect(await outcome(asUser(c.buyer.id, (tx) => tx`
      update restix.inquiries set seller_whatsapp = '+911234567890' where id = ${c.inquiryId}`))).toBe("42501");
  });
});

describe("finding sellers who bargain", () => {
  it("filters search to listings open to offers", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const open = await makeListing(seller.id, { negotiable: true });
    const fixed = await makeListing(seller.id, { negotiable: false });
    const ids = (await listings.searchListings(buyer.id, { offers: true, q: "Test Event" })).items.map((l) => l.id);
    expect(ids).toContain(open.listingId);
    expect(ids).not.toContain(fixed.listingId);
  });
});
