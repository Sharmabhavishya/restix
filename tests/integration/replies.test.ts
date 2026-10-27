import { describe, expect, it } from "vitest";
import { db, makeListing, makeUser, outcome } from "./helpers";

const inquiries = await import("@/server/inquiries");
const { asUser } = db;

describe("seller replies reach the buyer", () => {
  it("counts an unseen reply for the buyer until they open it", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: "Hey, still available?" });
    expect(await inquiries.unseenReplies(buyer.id)).toBe(0);
    const [inq] = await inquiries.inbox(seller.id);
    await inquiries.respondToInquiry(seller.id, { inquiryId: inq.id, decision: "accept", shareWhatsapp: false, note: "Library at 6" });
    expect(await inquiries.unseenReplies(buyer.id)).toBe(1);
    await inquiries.markRepliesSeen(buyer.id);
    expect(await inquiries.unseenReplies(buyer.id)).toBe(0);
  });

  it("only lets the buyer mark replies seen, and never lets them fake a response time", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: "Hey, still available?" });
    const [inq] = await inquiries.inbox(seller.id);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.inquiries set buyer_seen_at = now() where id = ${inq.id}`))).toBe("42501");
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      update restix.inquiries set responded_at = now() where id = ${inq.id}`))).toBe("42501");
  });
});
