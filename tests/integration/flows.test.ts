// Exercises the server modules the pages call, end to end against the real schema.
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeUser } from "./helpers";

const listings = await import("@/server/listings");
const inquiries = await import("@/server/inquiries");
const moderation = await import("@/server/moderation");
const metrics = await import("@/server/metrics");
const events = await import("@/server/events");
const { completeSignIn } = await import("@/server/auth/complete-sign-in");

const input = (eventId: string, ticketTypeId: string, over: Record<string, unknown> = {}) => ({
  eventId, ticketTypeId, format: "wristband" as const, quantity: 2, askingPrice: 45_000, originalPrice: 50_000,
  priceNegotiable: false, bulkMinQuantity: null, bulkPrice: null, handoverMethod: "in_person" as const, meetupArea: "Library steps", handoverNotes: null,
  sellerNotes: null, expiresAt: null, ...over,
});

describe("sign-in completion", () => {
  it("creates a verified profile for an allowed, verified email", async () => {
    await import("./helpers").then((h) => h.college());
    const id = crypto.randomUUID();
    await db.asSystem((tx) => tx`insert into auth.users (id, email) values (${id}, 'new.student@snu.edu.in')`);
    const r = await completeSignIn({ id, email: "New.Student@SNU.edu.in", emailVerified: true, fullName: "New Student" });
    expect(r).toEqual({ ok: true, isNew: true, onboarded: false });
    const [p] = await db.asSystem((tx) => tx`select display_name, email_verified_at from restix.profiles where id = ${id}`);
    expect(p.displayName).toBe("New Student");
    expect(p.emailVerifiedAt).not.toBeNull();
  });

  it("recognises a returning, onboarded student", async () => {
    const user = await makeUser();
    await db.asSystem((tx) => tx`update restix.profiles set onboarded_at = now() where id = ${user.id}`);
    expect(await completeSignIn({ id: user.id, email: user.email, emailVerified: true })).toEqual({ ok: true, isNew: false, onboarded: true });
  });

  it("refuses other domains, lookalikes and unverified emails without creating a profile", async () => {
    for (const [email, verified, reason] of [
      ["someone@gmail.com", true, "domain_not_allowed"],
      ["x@snu.edu.in.evil.com", true, "domain_not_allowed"],
      ["x@snu.edu.in", false, "unverified_email"],
    ] as const) {
      const id = crypto.randomUUID();
      const r = await completeSignIn({ id, email, emailVerified: verified });
      expect(r).toEqual({ ok: false, reason });
      const rows = await db.asSystem((tx) => tx`select 1 from restix.profiles where id = ${id}`);
      expect(rows).toHaveLength(0);
    }
  });
});

describe("the core journey", () => {
  it("list a wristband, inquire, accept, sell, confirm, report, moderate, and measure it", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const admin = await makeUser({ role: "admin" });
    const ev = await makeEvent({ policy: "allowed" });

    const created = await listings.createListing(seller.id, input(ev.eventId, ev.ticketTypeId), "publish");
    expect(created).toMatchObject({ ok: true });
    const listingId = (created as { id: string }).id;

    const found = await listings.searchListings(buyer.id, { q: "Test Event", format: "wristband" });
    expect(found.items.map((l) => l.id)).toContain(listingId);

    const detail = await listings.getListing(buyer.id, listingId);
    expect(detail?.status).toBe("active");
    expect(listings.displayStatus(detail!)).toBe("active");

    expect(await inquiries.sendInquiry(buyer.id, { listingId, quantity: 3, message: "Can I get three of these please?" }))
      .toMatchObject({ ok: false });
    expect(await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: "Hi! Is this still available?" }))
      .toEqual({ ok: true });
    expect(await inquiries.sendInquiry(buyer.id, { listingId, quantity: 1, message: "Hi again, still available?" }))
      .toMatchObject({ ok: false });
    expect(await inquiries.sendInquiry(seller.id, { listingId, quantity: 1, message: "Buying my own ticket" }))
      .toMatchObject({ ok: false });

    const [inq] = await inquiries.inbox(seller.id);
    expect(inq).toMatchObject({ role: "seller", status: "pending", listingId });
    // Accepting with nothing to share is refused; with a note it works and only the parties see it.
    expect(await inquiries.respondToInquiry(seller.id, { inquiryId: inq.id, decision: "accept", shareWhatsapp: true, note: null }))
      .toMatchObject({ ok: false });
    expect(await inquiries.respondToInquiry(seller.id, { inquiryId: inq.id, decision: "accept", shareWhatsapp: false, note: "Text me on 98765 43210" }))
      .toEqual({ ok: true });
    const [buyerView] = await inquiries.inbox(buyer.id);
    expect(buyerView.sellerContactShared).toContain("98765 43210");

    const version = (await listings.getListing(seller.id, listingId))!.version;
    expect(await listings.sellerAction(seller.id, listingId, version, "mark_sold")).toMatchObject({ ok: true });
    // A stale version from another tab is refused.
    expect(await listings.sellerAction(seller.id, listingId, version, "pause")).toMatchObject({ ok: false });
    // Sold listings drop out of search.
    expect((await listings.searchListings(buyer.id, { q: "Test Event" })).items.map((l) => l.id)).not.toContain(listingId);
    // With inquiries on it, the listing can't be deleted (buyers keep their history).
    const v2 = (await listings.getListing(seller.id, listingId))!.version;
    expect(await listings.sellerAction(seller.id, listingId, v2, "delete")).toMatchObject({ ok: false });

    expect(await inquiries.confirmOutcome(buyer.id, { inquiryId: inq.id, outcome: "completed", note: null })).toMatchObject({ ok: true });
    expect(await inquiries.confirmOutcome(seller.id, { inquiryId: inq.id, outcome: "completed", note: null })).toMatchObject({ ok: true });
    expect(await inquiries.confirmOutcome(buyer.id, { inquiryId: inq.id, outcome: "disputed", note: null })).toMatchObject({ ok: false });

    // Report a second, suspicious listing and moderate it.
    const second = await listings.createListing(seller.id, input(ev.eventId, ev.ticketTypeId, { askingPrice: 10_000 }), "publish");
    const secondId = (second as { id: string }).id;
    const report = await moderation.submitReport(buyer.id, { listingId: secondId, reason: "scam", details: "Asked me to pay upfront" });
    expect(report).toMatchObject({ ok: true });
    expect(await moderation.submitReport(buyer.id, { listingId: secondId, reason: "spam", details: null })).toMatchObject({ ok: false });

    const queue = await moderation.reportQueue(admin.id);
    const queued = queue.find((r) => r.listingId === secondId)!;
    expect(queued.priority).toBe("high");
    // RLS: a student who is neither moderator nor reporter sees none of the queue.
    const stranger = await makeUser();
    expect(await moderation.reportQueue(stranger.id)).toHaveLength(0);

    expect(await moderation.moderateListing(admin.id, { listingId: secondId, action: "hide", reason: "Hidden while we check the report", reportId: queued.id }))
      .toEqual({ ok: true });
    expect(await moderation.moderateListing(buyer.id, { listingId: secondId, action: "restore", reason: "let me back" }))
      .toMatchObject({ ok: false });
    expect(await moderation.updateReport(admin.id, { reportId: queued.id, status: "resolved", note: "Seller asked for payment before meeting" }))
      .toEqual({ ok: true });
    const d = await moderation.reportDetail(admin.id, queued.id);
    expect(d?.report.status).toBe("resolved");
    expect(d?.history.map((h) => h.action)).toEqual(expect.arrayContaining(["hide_listing", "resolve_report"]));
    expect(d?.user?.email).toContain("@snu.edu.in");

    // Restrict the seller: they can browse but no longer list.
    expect(await moderation.moderateUser(admin.id, { userId: seller.id, action: "restrict", reason: "Repeated scam reports" })).toEqual({ ok: true });
    expect(await listings.createListing(seller.id, input(ev.eventId, ev.ticketTypeId), "publish")).toMatchObject({ ok: false });
    expect(await moderation.submitAppeal(seller.id, { message: "That was a misunderstanding, please review." })).toMatchObject({ ok: true });
    const [appeal] = await moderation.openAppeals(admin.id);
    expect(await moderation.decideAppeal(admin.id, { appealId: appeal.id, decision: "reversed", note: "Buyer withdrew the complaint" }))
      .toMatchObject({ ok: true });

    const day = 86_400_000;
    const m = await metrics.computeMetrics(admin.id, { from: new Date(Date.now() - day), to: new Date(Date.now() + day) });
    expect(m.listings.createdInRange).toBeGreaterThanOrEqual(2);
    expect(m.inquiryConversion.numerator).toBeGreaterThanOrEqual(1);
    expect(m.inquiryConversion.denominator).toBeGreaterThanOrEqual(2);
    expect(m.bothConfirmedCompleted).toBeGreaterThanOrEqual(1);
    expect(m.outcomes).toEqual(expect.arrayContaining([{ party: "buyer", outcome: "completed", count: expect.any(Number) }]));
    expect(m.daily.length).toBeGreaterThanOrEqual(2);
    // The dashboard page is admin-only; even if a student's session reached this function,
    // RLS keeps analytics events (usage, views) admin-only.
    const plain = await metrics.computeMetrics(buyer.id, { from: new Date(Date.now() - day), to: new Date(Date.now() + day) });
    expect(plain.activeUsers).toBe(0);
    expect(plain.views).toEqual([]);
  });
});

describe("event policies", () => {
  it("blocks prohibited events, reviews unknown ones, and caps face-value events", async () => {
    const seller = await makeUser();
    const prohibited = await makeEvent({ policy: "prohibited" });
    const unknown = await makeEvent({ policy: "unknown" });
    const faceValue = await makeEvent({ policy: "face_value_only" });
    const cancelled = await makeEvent({ status: "cancelled" });

    expect(await listings.createListing(seller.id, input(prohibited.eventId, prohibited.ticketTypeId), "publish")).toMatchObject({ ok: false });
    expect(await listings.createListing(seller.id, input(cancelled.eventId, cancelled.ticketTypeId), "publish")).toMatchObject({ ok: false });
    const review = await listings.createListing(seller.id, input(unknown.eventId, unknown.ticketTypeId), "publish");
    expect(review).toMatchObject({ ok: true });
    expect((await listings.getListing(seller.id, (review as { id: string }).id))?.status).toBe("pending_review");
    expect(await listings.createListing(seller.id, input(faceValue.eventId, faceValue.ticketTypeId, { askingPrice: 60_000 }), "publish"))
      .toMatchObject({ ok: false });
    expect(await listings.createListing(seller.id, input(faceValue.eventId, faceValue.ticketTypeId, { askingPrice: 50_000 }), "publish"))
      .toMatchObject({ ok: true });
  });

  it("lists upcoming events with live availability", async () => {
    const viewer = await makeUser();
    const list = await events.listUpcomingEvents(viewer.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((e) => e.availableListings >= 0)).toBe(true);
  });
});
