// Regression tests for the security review of 27 Oct 2026 (supabase/migrations/*_hardening.sql).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser, outcome } from "./helpers";

const { asUser, asSystem } = db;

const insertListing = (
  uid: string,
  ev: { eventId: string; ticketTypeId: string },
  over: { status?: string; ask?: number; orig?: number | null } = {},
) =>
  asUser(uid, (tx) => tx`
    insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
      original_price_paise, handover_method, status, expires_at)
    values (${ev.eventId}, ${ev.ticketTypeId}, ${uid}, 'wristband', 1, ${over.ask ?? 40000},
            ${over.orig === undefined ? 40000 : over.orig}, 'in_person', ${over.status ?? "active"}, now() + interval '1 day')
    returning id`);

async function otherCollege() {
  return asSystem(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      insert into restix.colleges (slug, name, short_name) values (${"c-" + randomUUID().slice(0, 8)}, 'Elsewhere', 'EW') returning id`;
    return c.id;
  });
}

describe("listing rules live in the database too", () => {
  it("refuses live listings that break the event's resale policy", async () => {
    const seller = await makeUser();
    expect(await outcome(insertListing(seller.id, await makeEvent({ policy: "prohibited" })))).toBe("23514");
    expect(await outcome(insertListing(seller.id, await makeEvent({ policy: "unknown" })))).toBe("23514");
    expect(await outcome(insertListing(seller.id, await makeEvent({ policy: "unknown" }), { status: "pending_review" }))).toBe("ok");
    expect(await outcome(insertListing(seller.id, await makeEvent({ status: "cancelled" })))).toBe("23514");
  });

  it("caps face-value events at the ticket's real face value, whatever price the seller claims", async () => {
    const seller = await makeUser();
    const ev = await makeEvent({ policy: "face_value_only" }); // ticket type face value: 50000
    expect(await outcome(insertListing(seller.id, ev, { ask: 500000, orig: 500000 }))).toBe("23514");
    expect(await outcome(insertListing(seller.id, ev, { ask: 50000, orig: 50000 }))).toBe("ok");
  });

  it("refuses a ticket type from a different event", async () => {
    const seller = await makeUser();
    const a = await makeEvent();
    const b = await makeEvent();
    expect(await outcome(insertListing(seller.id, { eventId: a.eventId, ticketTypeId: b.ticketTypeId }))).toBe("23514");
  });

  it("keeps rejected and closed listings from coming back live without a moderator", async () => {
    const seller = await makeUser();
    for (const status of ["rejected", "sold", "unavailable", "expired"]) {
      const { listingId } = await makeListing(seller.id, { status });
      expect(await outcome(asUser(seller.id, (tx) => tx`
        update restix.ticket_listings set status = 'active', version = version + 1 where id = ${listingId}`))).toBe("42501");
    }
    const draft = await makeListing(seller.id, { status: "draft" });
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'active', version = version + 1 where id = ${draft.listingId}`))).toBe("ok");
  });

  it("lets a restricted seller close a listing but not edit it", async () => {
    const seller = await makeUser();
    const a = await makeListing(seller.id);
    const b = await makeListing(seller.id);
    await asSystem((tx) => tx`update restix.profiles set status = 'restricted' where id = ${seller.id}`);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'sold', version = version + 1 where id = ${a.listingId}`))).toBe("ok");
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set asking_price_paise = 1, version = version + 1 where id = ${b.listingId}`))).toBe("42501");
  });

  it("won't delete a listing that buyers have contacted", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Is this still available?', 1)`);
    const deleted = await asUser(seller.id, (tx) => tx`delete from restix.ticket_listings where id = ${listingId} returning id`);
    expect(deleted).toHaveLength(0);
  });
});

describe("inserts can't pre-decide outcomes", () => {
  it("refuses an inquiry inserted as already accepted", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested, status, seller_contact_shared)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Is this still available?', 1, 'accepted', 'fake contact')`))).toBe("42501");
  });

  it("builds the report snapshot itself, ignoring what the reporter sends", async () => {
    const seller = await makeUser();
    const reporter = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const [r] = await asUser(reporter.id, (tx) => tx<{ targetSnapshot: Record<string, unknown>; reportedUserId: string }[]>`
      insert into restix.reports (reporter_id, listing_id, reason, target_snapshot, reported_user_id)
      values (${reporter.id}, ${listingId}, 'scam', ${tx.json({ event: "Forged", askingPricePaise: 1 })}, ${reporter.id})
      returning target_snapshot, reported_user_id`);
    expect(r.targetSnapshot.event).toBe("Test Event");
    expect(r.targetSnapshot.askingPricePaise).toBe(50000);
    expect(r.reportedUserId).toBe(seller.id);
  });

  it("refuses reports about people at another college", async () => {
    const elsewhere = await otherCollege();
    const outsider = await makeUser({ collegeId: elsewhere });
    const reporter = await makeUser();
    expect(await outcome(asUser(reporter.id, (tx) => tx`
      insert into restix.reports (reporter_id, reported_user_id, reason) values (${reporter.id}, ${outsider.id}, 'spam')`))).toBe("42501");
  });

  it("refuses pre-decided appeals and a second open appeal", async () => {
    const user = await makeUser();
    expect(await outcome(asUser(user.id, (tx) => tx`
      insert into restix.appeals (user_id, message, decision_note) values (${user.id}, 'Please review this decision', 'approved by me')`))).toBe("42501");
    await asUser(user.id, (tx) => tx`insert into restix.appeals (user_id, message) values (${user.id}, 'Please review this decision')`);
    expect(await outcome(asUser(user.id, (tx) => tx`
      insert into restix.appeals (user_id, message) values (${user.id}, 'And another one, please')`))).toBe("23505");
  });
});

describe("moderators act only within their college", () => {
  it("can't moderate another college's listings, accounts, events or private data", async () => {
    const elsewhere = await otherCollege();
    const foreignMod = await makeUser({ role: "admin", collegeId: elsewhere });
    const seller = await makeUser();
    const { listingId, eventId } = await makeListing(seller.id);
    expect(await asUser(foreignMod.id, (tx) => tx`
      update restix.ticket_listings set status = 'removed', version = version + 1 where id = ${listingId} returning id`)).toHaveLength(0);
    expect(await asUser(foreignMod.id, (tx) => tx`
      update restix.profiles set status = 'suspended' where id = ${seller.id} returning id`)).toHaveLength(0);
    expect(await asUser(foreignMod.id, (tx) => tx`
      update restix.events set status = 'cancelled' where id = ${eventId} returning id`)).toHaveLength(0);
    expect(await asUser(foreignMod.id, (tx) => tx`
      select email from restix.profile_private where user_id = ${seller.id}`)).toHaveLength(0);
  });

  it("only an admin of the event's own college can delete it", async () => {
    const { eventId } = await makeEvent();
    const mod = await makeUser({ role: "moderator" });
    const farAdmin = await makeUser({ role: "admin", collegeId: await otherCollege() });
    for (const who of [mod.id, farAdmin.id]) {
      expect(await asUser(who, (tx) => tx`delete from restix.events where id = ${eventId} returning id`)).toHaveLength(0);
    }
    const admin = await makeUser({ role: "admin" });
    expect(await asUser(admin.id, (tx) => tx`delete from restix.events where id = ${eventId} returning id`)).toHaveLength(1);
  });

  it("admins can't change their own role", async () => {
    const admin = await makeUser({ role: "admin" });
    const rows = await asUser(admin.id, (tx) => tx`delete from restix.admin_roles where user_id = ${admin.id} returning user_id`);
    expect(rows).toHaveLength(0);
  });
});
