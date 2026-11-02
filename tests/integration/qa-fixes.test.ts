// Problems found by the pre-launch simulation, each tried and refused or fixed.
import { describe, expect, it } from "vitest";
import { db, makeListing, makeUser, outcome } from "./helpers";

const inquiries = await import("@/server/inquiries");
const listings = await import("@/server/listings");
const { asSystem, asUser } = db;

const MSG = "Hi, is this ticket still available?";
const setPrice = (id: string, paise: number) =>
  asSystem((tx) => tx`update restix.ticket_listings set asking_price_paise = ${paise}, version = version + 1 where id = ${id}`);
// Lets a test pretend the current price has been live for two days (the trigger would otherwise reset it).
const backdatePrice = (id: string) =>
  asSystem(async (tx) => {
    await tx`set local session_replication_role = replica`; // triggers off for this transaction only
    await tx`update restix.ticket_listings set price_set_at = now() - interval '2 days' where id = ${id}`;
  });
const previous = async (id: string) =>
  (await asSystem((tx) => tx<{ previous: number | null }[]>`select previous_price_paise as previous from restix.ticket_listings where id = ${id}`))[0].previous;

describe("the 'was ₹X' markdown", () => {
  it("can't be faked by raising the price and dropping it back", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id); // ₹500
    await setPrice(listingId, 900_000);
    await setPrice(listingId, 50_000);
    expect(await previous(listingId)).toBeNull();
  });

  it("shows an honest cut after the old price had been live for a day", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await backdatePrice(listingId);
    await setPrice(listingId, 40_000);
    expect(await previous(listingId)).toBe(50_000);
    // A second cut an hour later keeps the original "was" price instead of using the one that was just set.
    await setPrice(listingId, 30_000);
    expect(await previous(listingId)).toBe(50_000);
  });
});

describe("outcomes", () => {
  it("can't be recorded on a request that was closed without the seller saying yes, even with a reply time stamped", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: MSG });
    const [inq] = await inquiries.inbox(seller.id);
    await asSystem((tx) => tx`update restix.inquiries set status = 'closed', responded_at = now() where id = ${inq.id}`);
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      insert into restix.transaction_confirmations (inquiry_id, user_id, party, outcome) values (${inq.id}, ${buyer.id}, 'buyer', 'not_completed')`))).toBe("42501");
  });

  it("marking a listing sold closes pending requests without calling them answered", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: MSG });
    const [row] = await asSystem((tx) => tx<{ version: number }[]>`select version from restix.ticket_listings where id = ${listingId}`);
    expect(await listings.sellerAction(seller.id, listingId, row.version, "mark_sold")).toMatchObject({ ok: true });
    const [inq] = await asSystem((tx) => tx<{ status: string; respondedAt: Date | null }[]>`select status, responded_at from restix.inquiries where listing_id = ${listingId}`);
    expect(inq).toEqual({ status: "closed", respondedAt: null });
  });
});

describe("event requests, appeals and paging", () => {
  it("keeps phone numbers, links and handles out of an event request", async () => {
    const { suggestionInput } = await import("@/server/event-admin");
    expect(suggestionInput.safeParse({ name: "Spring Fest", details: "Organised by the cultural committee" }).success).toBe(true);
    for (const bad of [{ details: "call 9876543210 for tickets" }, { details: "insta @scammer" }, { venue: "https://evil.example/x" }, { name: "Fest dm me" }]) {
      expect(suggestionInput.safeParse({ name: "Spring Fest", ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("refuses an appeal when there is nothing to appeal, and accepts one from a restricted student", async () => {
    const moderation = await import("@/server/moderation");
    const mod = await makeUser({ role: "moderator" });
    const fine = await makeUser();
    expect(await moderation.submitAppeal(fine.id, { message: "Please look again, this feels unfair." })).toMatchObject({ ok: false, error: expect.stringContaining("nothing to appeal") });
    const restricted = await makeUser();
    expect(await moderation.moderateUser(mod.id, { userId: restricted.id, action: "restrict", reason: "Repeated reports" })).toEqual({ ok: true });
    expect(await moderation.submitAppeal(restricted.id, { message: "Please look again, this feels unfair." })).toMatchObject({ ok: true });
  });

  it("reinstating a student brings back the listings that were paused by the restriction", async () => {
    const moderation = await import("@/server/moderation");
    const mod = await makeUser({ role: "moderator" });
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await moderation.moderateUser(mod.id, { userId: seller.id, action: "restrict", reason: "Too many reports" });
    const status = async () => (await asSystem((tx) => tx<{ status: string; reason: string | null }[]>`select status, status_reason as reason from restix.ticket_listings where id = ${listingId}`))[0];
    expect(await status()).toMatchObject({ status: "paused" });
    expect(await moderation.moderateUser(mod.id, { userId: seller.id, action: "reinstate", reason: "Appeal upheld" })).toEqual({ ok: true });
    expect(await status()).toEqual({ status: "active", reason: null });
  });

  it("shows the last page when a page past the end is asked for", async () => {
    const viewer = await makeUser();
    await makeListing((await makeUser()).id);
    const r = await listings.searchListings(viewer.id, { page: 999, sort: "newest" } as never);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.page).toBe(r.pages);
  });
});
