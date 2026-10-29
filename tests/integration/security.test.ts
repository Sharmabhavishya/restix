// Attacks found by the 2026-10-29 security review, each one tried and refused.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { college, db, makeEvent, makeListing, makeUser, outcome } from "./helpers";

const inquiries = await import("@/server/inquiries");
const moderation = await import("@/server/moderation");
const admin = await import("@/server/admin");
const profile = await import("@/server/profile");
const eventAdmin = await import("@/server/event-admin");
const { completeSignIn } = await import("@/server/auth/complete-sign-in");
const { asSystem, asUser } = db;

const MSG = "Hi, is this ticket still available?";

async function accepted() {
  const seller = await makeUser();
  const buyer = await makeUser();
  const { listingId } = await makeListing(seller.id);
  await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: MSG });
  const [inq] = await inquiries.inbox(seller.id);
  await inquiries.respondToInquiry(seller.id, { inquiryId: inq.id, decision: "accept", shareWhatsapp: false, note: "Library steps" });
  return { seller, buyer, listingId, inquiryId: inq.id };
}

describe("listings", () => {
  it("won't let a seller walk a rejected listing back to live", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await asSystem((tx) => tx`update restix.ticket_listings set status = 'rejected', version = version + 1 where id = ${listingId}`);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'paused', version = version + 1 where id = ${listingId}`))).toBe("42501");
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'draft', version = version + 1 where id = ${listingId}`))).toBe("42501");
    // Editing it, which sends it back for review, still works.
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'pending_review', version = version + 1 where id = ${listingId}`))).toBe("ok");
  });

  it("won't let a seller delete a listing someone has reported", async () => {
    const seller = await makeUser();
    const reporter = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await moderation.submitReport(reporter.id, { listingId, reason: "scam", details: null })).toMatchObject({ ok: true });
    const gone = await asUser(seller.id, (tx) => tx`delete from restix.ticket_listings where id = ${listingId} returning id`);
    expect(gone).toHaveLength(0);
  });

  it("sends a face-value listing to review when the ticket type has no face value on record", async () => {
    const seller = await makeUser();
    const { eventId } = await makeEvent({ policy: "face_value_only" });
    const [t] = await asSystem((tx) => tx<{ id: string }[]>`
      insert into restix.ticket_types (event_id, name, face_value_paise) values (${eventId}, 'Mystery', null) returning id`);
    const listings = await import("@/server/listings");
    const input = {
      eventId, ticketTypeId: t.id, format: "qr" as const, quantity: 1, askingPrice: 999_900, originalPrice: 999_900,
      priceNegotiable: false, bulkMinQuantity: null, bulkPrice: null, handoverMethod: "digital_transfer" as const, meetupArea: null,
      handoverNotes: null, sellerNotes: null, expiresAt: null,
    };
    const made = await listings.createListing(seller.id, input, "publish");
    expect(made).toMatchObject({ ok: true });
    expect((await listings.getListing(seller.id, (made as { id: string }).id))?.status).toBe("pending_review");
  });

  it("still lets people resell above face value on an event with no cap", async () => {
    const seller = await makeUser();
    const { eventId, ticketTypeId } = await makeEvent({ policy: "allowed" }); // face value 50000
    const listings = await import("@/server/listings");
    const made = await listings.createListing(seller.id, {
      eventId, ticketTypeId, format: "qr" as const, quantity: 1, askingPrice: 150_000, originalPrice: 50_000,
      priceNegotiable: true, bulkMinQuantity: null, bulkPrice: null, handoverMethod: "digital_transfer" as const, meetupArea: null,
      handoverNotes: null, sellerNotes: null, expiresAt: null,
    }, "publish");
    expect(made).toMatchObject({ ok: true });
    const seen = await listings.getListing(seller.id, (made as { id: string }).id);
    expect(seen).toMatchObject({ status: "active", askingPricePaise: 150_000 });
  });

  it("reprices live listings when an event becomes face-value-only", async () => {
    const seller = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const ev = await makeEvent({ policy: "allowed" }); // face value 50000
    const fair = await makeListing(seller.id, { eventId: ev.eventId, ticketTypeId: ev.ticketTypeId });
    const dear = await makeListing(seller.id, { eventId: ev.eventId, ticketTypeId: ev.ticketTypeId });
    await asSystem((tx) => tx`update restix.ticket_listings set original_price_paise = 50000, version = version + 1 where id = ${fair.listingId}`);
    await asSystem((tx) => tx`update restix.ticket_listings set original_price_paise = 90000, asking_price_paise = 90000, version = version + 1 where id = ${dear.listingId}`);

    const [row] = await asSystem((tx) => tx<{ name: string; slug: string; startsAt: Date }[]>`select name, slug, starts_at from restix.events where id = ${ev.eventId}`);
    const saved = await eventAdmin.saveEvent(mod.id, await college(), {
      name: row.name, slug: row.slug, category: "fest", venue: null, description: null, startsAt: row.startsAt, endsAt: null,
      status: "scheduled", transferPolicy: "face_value_only", policySource: "Organisers' notice", ticketFormat: null,
      ticketTypes: [{ name: "General", faceValuePaise: 50000 }], reason: "Organisers capped resale",
    }, ev.eventId);
    expect(saved, JSON.stringify(saved)).toMatchObject({ ok: true });
    const status = async (id: string) => (await asSystem((tx) => tx<{ status: string }[]>`select status from restix.ticket_listings where id = ${id}`))[0].status;
    expect(await status(fair.listingId)).toBe("active"); // at or under face value: untouched
    expect(await status(dear.listingId)).toBe("draft"); // over it: back to the seller to reprice
  });
});

describe("inquiries and outcomes", () => {
  it("starts every inquiry empty, whatever the buyer tries to plant", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const [row] = await asUser(buyer.id, (tx) => tx<{ agreedPricePaise: number | null; sellerWhatsapp: string | null }[]>`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested, agreed_price_paise, seller_whatsapp)
      values (${listingId}, ${buyer.id}, ${seller.id}, ${MSG}, 1, 100, '+919999999999')
      returning agreed_price_paise, seller_whatsapp`);
    expect(row).toEqual({ agreedPricePaise: null, sellerWhatsapp: null });
  });

  it("only counts an outcome for a request the seller actually accepted", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: MSG });
    const [inq] = await inquiries.inbox(seller.id);
    // The listing is sold to someone else: the unanswered request is closed, never accepted.
    await asSystem((tx) => tx`update restix.inquiries set status = 'closed' where id = ${inq.id}`);
    expect(await inquiries.confirmOutcome(buyer.id, { inquiryId: inq.id, outcome: "completed", note: null })).toMatchObject({ ok: false });
    expect(await inquiries.confirmOutcome(seller.id, { inquiryId: inq.id, outcome: "completed", note: null })).toMatchObject({ ok: false });
    // The database says the same, straight to the table.
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      insert into restix.transaction_confirmations (inquiry_id, user_id, party, outcome) values (${inq.id}, ${buyer.id}, 'buyer', 'completed')`))).toBe("42501");
  });

  it("does count one for a request that was accepted and then closed", async () => {
    const c = await accepted();
    expect(await inquiries.closeInquiry(c.seller.id, c.inquiryId)).toMatchObject({ ok: true });
    expect(await inquiries.confirmOutcome(c.buyer.id, { inquiryId: c.inquiryId, outcome: "completed", note: null })).toMatchObject({ ok: true });
  });

  it("keeps recent handovers on record: neither side can delete their account yet", async () => {
    const c = await accepted();
    for (const who of [c.seller.id, c.buyer.id]) {
      expect(await profile.deleteAccount(who)).toMatchObject({ ok: false, error: expect.stringContaining("60 days") });
    }
    // Once the 60 days pass, it goes through.
    await asSystem((tx) => tx`update restix.inquiries set responded_at = now() - interval '61 days' where id = ${c.inquiryId}`);
    expect(await profile.deleteAccount(c.buyer.id)).toEqual({ ok: true });
  });
});

describe("reports and the audit log", () => {
  it("refuses a report that points at nothing", async () => {
    const reporter = await makeUser();
    expect(await outcome(asUser(reporter.id, (tx) => tx`
      insert into restix.reports (reporter_id, reason, target_snapshot) values (${reporter.id}, 'spam', '{"junk": 1}'::jsonb)`))).toBe("23514");
  });

  it("won't take audit entries about another college from a moderator", async () => {
    const mod = await makeUser({ role: "moderator" });
    const [far] = await asSystem((tx) => tx<{ id: string }[]>`
      insert into restix.colleges (slug, name, short_name) values (${"c-" + randomUUID().slice(0, 8)}, 'Elsewhere', 'EW') returning id`);
    const stranger = await makeUser({ collegeId: far.id });
    expect(await outcome(asUser(mod.id, (tx) => tx`
      insert into restix.moderation_actions (actor_id, action, reason, user_id) values (${mod.id}, 'suspend_user', 'made up', ${stranger.id})`))).toBe("42501");
    // Their own college is fine.
    const own = await makeUser();
    expect(await outcome(asUser(mod.id, (tx) => tx`
      insert into restix.moderation_actions (actor_id, action, reason, user_id) values (${mod.id}, 'restrict_user', 'real reason', ${own.id})`))).toBe("ok");
  });

  it("keeps the housekeeping functions away from students", async () => {
    const student = await makeUser();
    expect(await outcome(asUser(student.id, (tx) => tx`select restix.hit_rate_limit('x', 1, 60)`))).toBe("42501");
    expect(await outcome(asUser(student.id, (tx) => tx`select restix.purge_old_data()`))).toBe("42501");
    expect(await outcome(asUser(student.id, (tx) => tx`select restix.expire_listings()`))).toBe("42501");
  });
});

describe("accounts", () => {
  it("shows WhatsApp numbers to the admin, never to a moderator", async () => {
    const c = await (async () => {
      const [cc] = await asSystem((tx) => tx<{ id: string }[]>`
        insert into restix.colleges (slug, name, short_name) values (${"c-" + randomUUID().slice(0, 8)}, 'Numbers College', 'NC') returning id`);
      return cc.id;
    })();
    const boss = await makeUser({ role: "admin", collegeId: c });
    const mod = await makeUser({ role: "moderator", collegeId: c });
    const student = await makeUser({ collegeId: c });
    await asSystem((tx) => tx`update restix.profile_private set whatsapp_number = '+919811122233' where user_id = ${student.id}`);
    const find = (rows: { id: string; whatsappNumber: string | null }[]) => rows.find((r) => r.id === student.id)!.whatsappNumber;
    expect(find((await admin.listAccounts(boss.id, { q: "", show: "all", page: 1 })).rows)).toBe("+919811122233");
    expect(find((await admin.listAccounts(mod.id, { q: "", show: "all", page: 1 })).rows)).toBeNull();
  });

  it("cleans the name Google gives us, and won't show a phone number or disguised text as a name", async () => {
    await college();
    const signIn = async (fullName: string, email: string) => {
      const id = randomUUID();
      await asSystem((tx) => tx`insert into auth.users (id, email) values (${id}, ${email})`);
      expect(await completeSignIn({ id, email, emailVerified: true, fullName })).toMatchObject({ ok: true });
      return (await asSystem((tx) => tx<{ displayName: string }[]>`select display_name from restix.profiles where id = ${id}`))[0].displayName;
    };
    // A right-to-left override and invisible characters are stripped.
    expect(await signIn("Asha‮ K​", "asha.clean@snu.edu.in")).toBe("Asha K");
    // A name that is really a phone number or a handle falls back to the email's first part.
    expect(await signIn("Call 98765 43210", "num.name@snu.edu.in")).toBe("num name");
    expect(await signIn("@asha_official", "handle.name@snu.edu.in")).toBe("handle name");
  });
});
