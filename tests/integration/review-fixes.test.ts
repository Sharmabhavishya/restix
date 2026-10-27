// App-level regressions for the security review of 27 Oct 2026.
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser } from "./helpers";

const listings = await import("@/server/listings");
const moderation = await import("@/server/moderation");
const profile = await import("@/server/profile");

const input = (eventId: string, ticketTypeId: string, over: Record<string, unknown> = {}) => ({
  eventId, ticketTypeId, format: "wristband" as const, quantity: 1, askingPrice: 45_000, originalPrice: 50_000,
  priceNegotiable: false, handoverMethod: "in_person" as const, meetupArea: null, handoverNotes: null,
  sellerNotes: null, expiresAt: null, ...over,
});

describe("security review fixes", () => {
  it("caps face-value listings at the ticket's published face value", async () => {
    const seller = await makeUser();
    const ev = await makeEvent({ policy: "face_value_only" }); // face value 50000
    const r = await listings.createListing(seller.id, input(ev.eventId, ev.ticketTypeId, { askingPrice: 90_000, originalPrice: 90_000 }), "publish");
    expect(r).toMatchObject({ ok: false });
  });

  it("sends a rejected listing back to review when republished", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id, { status: "rejected" });
    const v = (await listings.getListing(seller.id, listingId))!.version;
    expect(await listings.sellerAction(seller.id, listingId, v, "publish")).toMatchObject({ ok: true });
    expect((await listings.getListing(seller.id, listingId))!.status).toBe("pending_review");
  });

  it("refuses a moderator approval for a version they didn't see", async () => {
    const seller = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const { listingId } = await makeListing(seller.id, { status: "pending_review" });
    const r = await moderation.moderateListing(mod.id, { listingId, action: "approve", reason: "looks fine", version: 99 });
    expect(r).toMatchObject({ ok: false });
  });

  it("pauses a restricted seller's live listings and links their appeal to the decision", async () => {
    const seller = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const { listingId } = await makeListing(seller.id);
    expect(await moderation.moderateUser(mod.id, { userId: seller.id, action: "restrict", reason: "Repeated reports" })).toEqual({ ok: true });
    expect((await listings.getListing(seller.id, listingId))!.status).toBe("paused");
    expect(await moderation.submitAppeal(seller.id, { message: "I think this was a mistake, please check." })).toMatchObject({ ok: true });
    const [appeal] = (await moderation.openAppeals(mod.id)).filter((a) => a.userId === seller.id);
    expect(appeal.actionName).toBe("restrict_user");
  });

  it("won't delete an account with an open report against it", async () => {
    const seller = await makeUser();
    const reporter = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await moderation.submitReport(reporter.id, { listingId, reason: "scam", details: null });
    expect(await profile.deleteAccount(seller.id)).toMatchObject({ ok: false });
    const [row] = await db.asSystem((tx) => tx`select 1 as x from restix.profiles where id = ${seller.id}`);
    expect(row).toBeTruthy();
  });
});
