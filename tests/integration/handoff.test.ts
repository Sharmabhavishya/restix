import { describe, expect, it } from "vitest";
import { db, makeListing, makeUser, outcome } from "./helpers";

const inquiries = await import("@/server/inquiries");
const { asSystem, asUser } = db;

const MSG = "Hey, is this still available?";
const BUYER_NO = "+919811122233";
const SELLER_NO = "+919876543210";

async function setup(opts: { share?: boolean; buyerNumber?: string | null } = {}) {
  const seller = await makeUser();
  const buyer = await makeUser();
  await asSystem((tx) => tx`update restix.profile_private set whatsapp_number = ${SELLER_NO} where user_id = ${seller.id}`);
  const { listingId } = await makeListing(seller.id);
  const sent = await inquiries.sendInquiry(buyer.id, {
    listingId, quantity: 1, message: MSG, shareWhatsapp: opts.share ?? true, whatsapp: opts.buyerNumber === undefined ? BUYER_NO : opts.buyerNumber,
  });
  expect(sent).toEqual({ ok: true });
  const [inq] = await inquiries.inbox(seller.id);
  return { seller, buyer, inquiryId: inq.id };
}

const sellerView = async (sellerId: string, id: string) => (await inquiries.inbox(sellerId)).find((r) => r.id === id)!;
const buyerView = async (buyerId: string, id: string) => (await inquiries.inbox(buyerId)).find((r) => r.id === id)!;

describe("private until accepted", () => {
  it("shows nobody's number while the request is pending, then both on a yes", async () => {
    const c = await setup();
    expect((await sellerView(c.seller.id, c.inquiryId)).buyerWhatsapp).toBeNull();
    expect((await buyerView(c.buyer.id, c.inquiryId)).sellerWhatsapp).toBeNull();
    // ...and the seller can't read the buyer's private profile directly either.
    expect(await asUser(c.seller.id, (tx) => tx`select whatsapp_number from restix.profile_private where user_id = ${c.buyer.id}`)).toHaveLength(0);

    expect(await inquiries.respondToInquiry(c.seller.id, { inquiryId: c.inquiryId, decision: "accept", shareWhatsapp: true, note: null })).toMatchObject({ ok: true });
    expect((await sellerView(c.seller.id, c.inquiryId)).buyerWhatsapp).toBe(BUYER_NO);
    expect((await buyerView(c.buyer.id, c.inquiryId)).sellerWhatsapp).toBe(SELLER_NO);
  });

  it("keeps the buyer's number back if they opted out, or a declined buyer's", async () => {
    const out = await setup({ share: false });
    await inquiries.respondToInquiry(out.seller.id, { inquiryId: out.inquiryId, decision: "accept", shareWhatsapp: true, note: null });
    expect((await sellerView(out.seller.id, out.inquiryId)).buyerWhatsapp).toBeNull();

    const no = await setup();
    await inquiries.respondToInquiry(no.seller.id, { inquiryId: no.inquiryId, decision: "decline", shareWhatsapp: false, note: null });
    expect((await sellerView(no.seller.id, no.inquiryId)).buyerWhatsapp).toBeNull();
  });

  it("saves a new number to the buyer's own profile", async () => {
    const c = await setup({ buyerNumber: "+447700900123" });
    const [own] = await asUser(c.buyer.id, (tx) => tx<{ whatsappNumber: string }[]>`select whatsapp_number from restix.profile_private where user_id = ${c.buyer.id}`);
    expect(own.whatsappNumber).toBe("+447700900123");
  });

  it("won't let anyone plant or change the buyer's number by hand", async () => {
    const c = await setup();
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    // Planted on insert: wiped by the database.
    await asUser(c.buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested, buyer_whatsapp)
      values (${listingId}, ${c.buyer.id}, ${seller.id}, ${MSG}, 1, '+911234567890')`).catch(() => null);
    const planted = await asSystem((tx) => tx`select buyer_whatsapp from restix.inquiries where listing_id = ${listingId}`);
    for (const row of planted) expect(row.buyerWhatsapp).toBeNull();
    // Edited afterwards: no column grant for either side.
    for (const who of [c.buyer.id, c.seller.id]) {
      expect(await outcome(asUser(who, (tx) => tx`update restix.inquiries set buyer_whatsapp = '+911234567890' where id = ${c.inquiryId}`))).toBe("42501");
      expect(await outcome(asUser(who, (tx) => tx`update restix.inquiries set buyer_shares_whatsapp = false where id = ${c.inquiryId}`))).toBe("42501");
    }
  });
});
