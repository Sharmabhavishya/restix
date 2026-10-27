import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser, outcome } from "./helpers";

const listings = await import("@/server/listings");
const events = await import("@/server/events");
const saved = await import("@/server/saved");
const { asSystem, asUser } = db;

const input = (over: Record<string, unknown> = {}) => ({
  eventId: "", ticketTypeId: "", format: "wristband" as const, quantity: 4, askingPrice: 40000, originalPrice: null,
  priceNegotiable: false, bulkMinQuantity: null, bulkPrice: null, handoverMethod: "in_person" as const,
  meetupArea: null, handoverNotes: null, sellerNotes: null, expiresAt: null, ...over,
});

async function otherCollege() {
  return asSystem(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      insert into restix.colleges (slug, name, short_name) values (${"c-" + randomUUID().slice(0, 8)}, 'Other College', 'OC') returning id`;
    return c.id;
  });
}

describe("ticket formats in the database", () => {
  it("accepts every format with a handover that fits it", async () => {
    const seller = await makeUser();
    const ev = await makeEvent();
    for (const [format, handoverMethod] of [
      ["wristband", "in_person"], ["paper", "in_person"], ["pass", "in_person"], ["token", "in_person"],
      ["qr", "either"], ["email", "digital_transfer"], ["app", "digital_transfer"], ["other", "in_person"],
    ] as const) {
      const r = await listings.createListing(seller.id, input({ ...ev, format, handoverMethod }), "publish");
      expect(r, format).toMatchObject({ ok: true });
    }
  });

  it("refuses the old 'digital' value and handovers that don't fit, even past the app", async () => {
    const seller = await makeUser();
    const ev = await makeEvent();
    const insert = (format: string, handover: string) =>
      asUser(seller.id, (tx) => tx`
        insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
          handover_method, status, expires_at)
        values (${ev.eventId}, ${ev.ticketTypeId}, ${seller.id}, ${format}, 1, 1000, ${handover}, 'draft', now() + interval '1 day')`);
    expect(await outcome(insert("digital", "digital_transfer"))).toBe("23514");
    expect(await outcome(insert("wristband", "digital_transfer"))).toBe("23514");
    expect(await outcome(insert("token", "either"))).toBe("23514");
    expect(await outcome(insert("app", "in_person"))).toBe("23514");
    expect(await outcome(insert("qr", "in_person"))).toBe("ok");
  });
});

describe("multi-ticket deals", () => {
  it("stores a deal and shows it on the card", async () => {
    const seller = await makeUser();
    const ev = await makeEvent();
    const r = await listings.createListing(seller.id, input({ ...ev, bulkMinQuantity: 3, bulkPrice: 35000 }), "publish");
    expect(r.ok).toBe(true);
    const card = await listings.getListing(seller.id, (r as { id: string }).id);
    expect([card?.bulkMinQuantity, card?.bulkPricePaise]).toEqual([3, 35000]);
  });

  it("refuses deals that aren't real discounts or don't fit the listing, at the database", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const set = (min: number | null, price: number | null, qty = 1) =>
      asUser(seller.id, (tx) => tx`
        update restix.ticket_listings set quantity = ${qty}, bulk_min_quantity = ${min}, bulk_price_paise = ${price},
          version = version + 1 where id = ${listingId}`);
    expect(await outcome(set(2, 40000, 1))).toBe("23514"); // needs more tickets than listed
    expect(await outcome(set(2, 50000, 3))).toBe("23514"); // not below the asking price
    expect(await outcome(set(2, null, 3))).toBe("23514"); // half a deal
    expect(await outcome(set(1, 40000, 3))).toBe("23514"); // a "deal" for one ticket
    expect(await outcome(set(11, 40000, 10))).toBe("23514");
    expect(await outcome(set(3, 0, 3))).toBe("ok"); // free when you take all three is allowed
  });

  it("keeps a restricted seller from changing the deal", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await asSystem((tx) => tx`update restix.profiles set status = 'restricted' where id = ${seller.id}`);
    const r = await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set quantity = 3, bulk_min_quantity = 2, bulk_price_paise = 100, version = version + 1
      where id = ${listingId}`));
    expect(r).toBe("42501");
  });
});

describe("only resale-allowed events reach students", () => {
  it("hides prohibited and unconfirmed events from the lists, and from the sell form", async () => {
    const viewer = await makeUser();
    const ok = await makeEvent({ policy: "allowed" });
    const capped = await makeEvent({ policy: "face_value_only" });
    const banned = await makeEvent({ policy: "prohibited" });
    const unknown = await makeEvent({ policy: "unknown" });
    const shown = (await events.listUpcomingEvents(viewer.id)).map((e) => e.id);
    expect(shown).toEqual(expect.arrayContaining([ok.eventId, capped.eventId]));
    expect(shown).not.toContain(banned.eventId);
    expect(shown).not.toContain(unknown.eventId);
    const sellable = (await events.listableEvents(viewer.id)).map((e) => e.id);
    expect(sellable).not.toContain(banned.eventId);
    expect(sellable).not.toContain(unknown.eventId);
    // ...but a seller can still reach the event of a listing they already have.
    expect((await events.listableEvents(viewer.id, unknown.eventId)).map((e) => e.id)).toContain(unknown.eventId);
  });
});

describe("good deals filter", () => {
  it("finds listings at least 10% under face value, and nothing else", async () => {
    const seller = await makeUser();
    const viewer = await makeUser();
    const ev = await makeEvent(); // face value ₹500
    const make = async (ask: number) =>
      ((await listings.createListing(seller.id, input({ ...ev, quantity: 1, askingPrice: ask }), "publish")) as { id: string }).id;
    const steal = await make(30000);
    const edge = await make(45000);
    const fair = await make(48000);
    const pricey = await make(70000);
    const found = (await listings.searchListings(viewer.id, { event: undefined, deals: true })).items.map((l) => l.id);
    expect(found).toEqual(expect.arrayContaining([steal, edge]));
    expect(found).not.toContain(fair);
    expect(found).not.toContain(pricey);
  });
});

describe("saved listings", () => {
  it("saves, lists and unsaves a listing, privately", async () => {
    const seller = await makeUser();
    const me = await makeUser();
    const someone = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await saved.setSaved(me.id, listingId, true)).toEqual({ ok: true, saved: true });
    expect(await saved.setSaved(me.id, listingId, true)).toEqual({ ok: true, saved: true }); // twice is fine
    expect(await saved.savedCount(me.id)).toBe(1);
    const mine = await listings.searchListings(me.id, { saved: true });
    expect(mine.items.map((l) => l.id)).toEqual([listingId]);
    expect(mine.items[0].saved).toBe(true);
    // Nobody else sees my saves, not even the seller.
    expect((await listings.searchListings(someone.id, { saved: true })).total).toBe(0);
    for (const who of [seller, someone]) {
      const rows = await asUser(who.id, (tx) => tx`select * from restix.saved_listings where user_id = ${me.id}`);
      expect(rows).toHaveLength(0);
    }
    expect(await saved.setSaved(me.id, listingId, false)).toEqual({ ok: true, saved: false });
    expect(await saved.savedCount(me.id)).toBe(0);
  });

  it("refuses your own listing, drafts, other colleges' listings, and saving for someone else", async () => {
    const seller = await makeUser();
    const me = await makeUser();
    const live = await makeListing(seller.id);
    const draft = await makeListing(seller.id, { status: "draft" });
    expect((await saved.setSaved(seller.id, live.listingId, true)).ok).toBe(false);
    expect((await saved.setSaved(me.id, draft.listingId, true)).ok).toBe(false);
    expect((await saved.setSaved(me.id, randomUUID(), true)).ok).toBe(false);
    expect((await saved.setSaved(me.id, "not-a-uuid", true)).ok).toBe(false);

    const away = await otherCollege();
    const farSeller = await makeUser({ collegeId: away });
    const farEvent = await makeEvent({ collegeId: away });
    const far = await makeListing(farSeller.id, farEvent);
    expect((await saved.setSaved(me.id, far.listingId, true)).ok).toBe(false);

    const forged = await outcome(asUser(me.id, (tx) => tx`
      insert into restix.saved_listings (user_id, listing_id) values (${seller.id}, ${live.listingId})`));
    expect(forged).toBe("42501");
  });

  it("caps the watchlist", async () => {
    const me = await makeUser();
    const seller = await makeUser();
    const ev = await makeEvent();
    await asSystem(async (tx) => {
      for (let i = 0; i < saved.MAX_SAVED; i++) {
        const [l] = await tx<{ id: string }[]>`
          insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
            handover_method, status, expires_at)
          values (${ev.eventId}, ${ev.ticketTypeId}, ${seller.id}, 'paper', 1, 1000, 'in_person', 'active', now() + interval '2 days')
          returning id`;
        await tx`insert into restix.saved_listings (user_id, listing_id) values (${me.id}, ${l.id})`;
      }
    });
    const extra = await makeListing(seller.id);
    const r = await saved.setSaved(me.id, extra.listingId, true);
    expect(r.ok).toBe(false);
  });

  it("drops saves when the listing is deleted", async () => {
    const seller = await makeUser();
    const me = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await saved.setSaved(me.id, listingId, true);
    await asSystem((tx) => tx`delete from restix.ticket_listings where id = ${listingId}`);
    const rows = await asSystem((tx) => tx`select 1 from restix.saved_listings where listing_id = ${listingId}`);
    expect(rows).toHaveLength(0);
  });
});
