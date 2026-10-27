import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser, outcome } from "./helpers";

const wants = await import("@/server/wants");
const events = await import("@/server/events");
const listings = await import("@/server/listings");
const inquiries = await import("@/server/inquiries");
const { asSystem, asUser } = db;

async function otherCollege() {
  return asSystem(async (tx) => {
    const [c] = await tx<{ id: string }[]>`insert into restix.colleges (slug, name, short_name) values (${"sg-" + randomUUID().slice(0, 8)}, 'Other', 'OT') returning id`;
    return c.id;
  });
}

describe("I want a ticket", () => {
  it("counts who's looking without saying who, and toggles", async () => {
    const { eventId } = await makeEvent();
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    expect(await wants.setWant(a.id, eventId, true)).toEqual({ ok: true, wanted: true });
    expect(await wants.setWant(a.id, eventId, true)).toEqual({ ok: true, wanted: true }); // twice is still one
    await wants.setWant(b.id, eventId, true);
    const seenByC = (await events.listUpcomingEvents(c.id)).find((e) => e.id === eventId)!;
    expect([seenByC.wantCount, seenByC.iWant]).toEqual([2, false]);
    expect((await events.listUpcomingEvents(a.id)).find((e) => e.id === eventId)!.iWant).toBe(true);
    // Nobody can list who wants it.
    expect(await asUser(c.id, (tx) => tx`select * from restix.event_wants where event_id = ${eventId}`)).toHaveLength(0);
    await wants.setWant(a.id, eventId, false);
    expect((await events.getEventBySlug(c.id, (await asSystem((tx) => tx<{ slug: string }[]>`select slug from restix.events where id = ${eventId}`))[0].slug))!.wantCount).toBe(1);
  });

  it("refuses wanting for someone else or for another college's event, and hides other colleges' counts", async () => {
    const me = await makeUser();
    const someone = await makeUser();
    const { eventId } = await makeEvent();
    expect(await outcome(asUser(me.id, (tx) => tx`insert into restix.event_wants (user_id, event_id) values (${someone.id}, ${eventId})`))).toBe("42501");
    const away = await otherCollege();
    const far = await makeEvent({ collegeId: away });
    expect((await wants.setWant(me.id, far.eventId, true)).ok).toBe(false);
    const farUser = await makeUser({ collegeId: away });
    await wants.setWant(farUser.id, far.eventId, true);
    const counts = await asUser(me.id, (tx) => tx`select * from restix.event_want_counts(${[far.eventId]}::uuid[])`);
    expect(counts).toHaveLength(0);
  });
});

describe("seller track record", () => {
  it("counts only handovers both sides confirmed, and reports a typical reply time", async () => {
    const seller = await makeUser();
    const viewer = await makeUser();
    const both = await makeUser();
    const oneSided = await makeUser();
    for (const buyer of [both, oneSided]) {
      const { listingId } = await makeListing(seller.id);
      await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: "Hey, is this still on?" });
      const [inq] = (await inquiries.inbox(seller.id)).filter((r) => r.listingId === listingId);
      await inquiries.respondToInquiry(seller.id, { inquiryId: inq.id, decision: "accept", shareWhatsapp: false, note: "Meet at the gate" });
      await inquiries.confirmOutcome(seller.id, { inquiryId: inq.id, outcome: "completed", note: null });
      if (buyer === both) await inquiries.confirmOutcome(buyer.id, { inquiryId: inq.id, outcome: "completed", note: null });
    }
    const stats = await listings.sellerStats(viewer.id, seller.id);
    expect(stats.handovers).toBe(1); // the seller's own word isn't enough
    expect(stats.replies).toBe(2);
    expect(stats.medianReplyMinutes).toBe(0);
  });

  it("says nothing about sellers from another college, or brand-new ones", async () => {
    const viewer = await makeUser();
    const away = await otherCollege();
    const farSeller = await makeUser({ collegeId: away });
    expect(await listings.sellerStats(viewer.id, farSeller.id)).toEqual({ handovers: 0, replies: 0, medianReplyMinutes: null });
    const fresh = await makeUser();
    expect(await listings.sellerStats(viewer.id, fresh.id)).toEqual({ handovers: 0, replies: 0, medianReplyMinutes: null });
  });
});

describe("price drops", () => {
  const setPrice = (sellerId: string, id: string, paise: number) =>
    asUser(sellerId, (tx) => tx`update restix.ticket_listings set asking_price_paise = ${paise}, version = version + 1 where id = ${id}`);
  const drop = async (viewerId: string, id: string) => (await listings.getListing(viewerId, id))!.previousPricePaise;

  it("remembers the highest recent price through a series of cuts, and forgets it on a rise", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id); // ₹500
    expect(await drop(seller.id, listingId)).toBeNull();
    await setPrice(seller.id, listingId, 45000);
    expect(await drop(seller.id, listingId)).toBe(50000);
    await setPrice(seller.id, listingId, 40000);
    expect(await drop(seller.id, listingId)).toBe(50000);
    await setPrice(seller.id, listingId, 48000);
    expect(await drop(seller.id, listingId)).toBeNull();
  });

  it("only shows a drop for a week, and can't be faked by the seller", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await setPrice(seller.id, listingId, 30000);
    await asSystem((tx) => tx`alter table restix.ticket_listings disable trigger listings_price_drop`);
    await asSystem((tx) => tx`update restix.ticket_listings set price_dropped_at = now() - interval '8 days', version = version + 1 where id = ${listingId}`);
    await asSystem((tx) => tx`alter table restix.ticket_listings enable trigger listings_price_drop`);
    expect(await drop(seller.id, listingId)).toBeNull();
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set previous_price_paise = 999999, price_dropped_at = now(), version = version + 1 where id = ${listingId}`))).toBe("42501");
  });
});
