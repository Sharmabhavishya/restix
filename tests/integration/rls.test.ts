// Attacks the database's own access rules directly, as an authenticated user would if
// the application layer had a bug. Every query runs through asUser(), the same path
// the app uses: role `authenticated` + the user's id in request.jwt.claims.
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser, outcome } from "./helpers";

const { asUser, asSystem } = db;

describe("listings", () => {
  it("lets an eligible student create their own listing", async () => {
    const seller = await makeUser();
    const ev = await makeEvent();
    const rows = await asUser(seller.id, (tx) => tx`
      insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
        handover_method, status, expires_at)
      values (${ev.eventId}, ${ev.ticketTypeId}, ${seller.id}, 'wristband', 1, 40000, 'in_person', 'active', now() + interval '1 day')
      returning id`);
    expect(rows).toHaveLength(1);
  });

  it("refuses listings from an account whose institutional email is not verified", async () => {
    const unverified = await makeUser({ verified: false });
    const ev = await makeEvent();
    const result = await outcome(asUser(unverified.id, (tx) => tx`
      insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
        handover_method, status, expires_at)
      values (${ev.eventId}, ${ev.ticketTypeId}, ${unverified.id}, 'wristband', 1, 40000, 'in_person', 'active', now() + interval '1 day')`));
    expect(result).toBe("42501");
  });

  it("refuses listings from restricted accounts", async () => {
    const restricted = await makeUser({ status: "restricted" });
    const ev = await makeEvent();
    const result = await outcome(asUser(restricted.id, (tx) => tx`
      insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
        handover_method, status, expires_at)
      values (${ev.eventId}, ${ev.ticketTypeId}, ${restricted.id}, 'wristband', 1, 40000, 'in_person', 'draft', now() + interval '1 day')`));
    expect(result).toBe("42501");
  });

  it("refuses a listing created in someone else's name", async () => {
    const attacker = await makeUser();
    const victim = await makeUser();
    const ev = await makeEvent();
    const result = await outcome(asUser(attacker.id, (tx) => tx`
      insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
        handover_method, status, expires_at)
      values (${ev.eventId}, ${ev.ticketTypeId}, ${victim.id}, 'wristband', 1, 40000, 'in_person', 'active', now() + interval '1 day')`));
    expect(result).toBe("42501");
  });

  it("does not let a user modify or delete another user's listing", async () => {
    const seller = await makeUser();
    const attacker = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const updated = await asUser(attacker.id, (tx) => tx`
      update restix.ticket_listings set asking_price_paise = 1, version = version + 1 where id = ${listingId} returning id`);
    const deleted = await asUser(attacker.id, (tx) => tx`delete from restix.ticket_listings where id = ${listingId} returning id`);
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const [row] = await asSystem((tx) => tx`select asking_price_paise from restix.ticket_listings where id = ${listingId}`);
    expect(row.askingPricePaise).toBe(50000);
  });

  it("blocks sellers from moderator-only statuses and from transferring ownership", async () => {
    const seller = await makeUser();
    const other = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'removed', version = version + 1 where id = ${listingId}`))).toBe("42501");
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set seller_id = ${other.id}, version = version + 1 where id = ${listingId}`))).toBe("42501");
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set reviewed_at = now(), version = version + 1 where id = ${listingId}`))).toBe("42501");
  });

  it("does not let a seller publish their own listing out of moderator review", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id, { status: "pending_review" });
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'active', version = version + 1 where id = ${listingId}`))).toBe("42501");
  });

  it("rejects conflicting writes that skip the optimistic version check", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set quantity = 2 where id = ${listingId}`))).toBe("40001");
    // A stale writer that read version 1 after someone else bumped it to 2 matches no rows.
    await asUser(seller.id, (tx) => tx`update restix.ticket_listings set quantity = 2, version = version + 1 where id = ${listingId} and version = 1`);
    const stale = await asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set quantity = 3, version = version + 1 where id = ${listingId} and version = 1 returning id`);
    expect(stale).toHaveLength(0);
  });

  it("hides drafts and review items from other students, and everything from unverified accounts", async () => {
    const seller = await makeUser();
    const viewer = await makeUser();
    const unverified = await makeUser({ verified: false });
    const draft = await makeListing(seller.id, { status: "draft" });
    const active = await makeListing(seller.id, { status: "active" });
    const seen = await asUser(viewer.id, (tx) => tx<{ id: string }[]>`
      select id from restix.ticket_listings where id in (${draft.listingId}, ${active.listingId})`);
    expect(seen.map((r) => r.id)).toEqual([active.listingId]);
    const unverifiedSees = await asUser(unverified.id, (tx) => tx`
      select id from restix.ticket_listings where id = ${active.listingId}`);
    expect(unverifiedSees).toHaveLength(0);
  });

  it("keeps other colleges' listings invisible", async () => {
    const other = await asSystem(async (tx) => {
      const [c] = await tx<{ id: string }[]>`
        insert into restix.colleges (slug, name, short_name) values ('other-college', 'Other College', 'OC')
        on conflict (slug) do update set name = excluded.name returning id`;
      return c.id;
    });
    const outsider = await makeUser({ collegeId: other });
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const rows = await asUser(outsider.id, (tx) => tx`select id from restix.ticket_listings where id = ${listingId}`);
    expect(rows).toHaveLength(0);
  });

  it("lets moderators remove a listing", async () => {
    const seller = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const { listingId } = await makeListing(seller.id);
    const rows = await asUser(mod.id, (tx) => tx`
      update restix.ticket_listings set status = 'removed', version = version + 1 where id = ${listingId} returning status`);
    expect(rows[0].status).toBe("removed");
    // ...and the seller cannot bring it back.
    expect(await outcome(asUser(seller.id, (tx) => tx`
      update restix.ticket_listings set status = 'active', version = version + 1 where id = ${listingId}`))).toBe("42501");
  });
});

describe("profiles and roles", () => {
  it("does not let a user verify themselves or change their own status", async () => {
    const user = await makeUser({ verified: false });
    expect(await outcome(asUser(user.id, (tx) => tx`
      update restix.profiles set email_verified_at = now() where id = ${user.id}`))).toBe("42501");
    const restricted = await makeUser({ status: "restricted" });
    expect(await outcome(asUser(restricted.id, (tx) => tx`
      update restix.profiles set status = 'active' where id = ${restricted.id}`))).toBe("42501");
  });

  it("lets nobody rename themselves or anyone else (names come from the Google account)", async () => {
    const user = await makeUser();
    const other = await makeUser();
    expect(await outcome(asUser(user.id, (tx) => tx`update restix.profiles set display_name = 'New Name' where id = ${user.id}`))).toBe("42501");
    expect(await outcome(asUser(user.id, (tx) => tx`update restix.profiles set display_name = 'Hacked' where id = ${other.id}`))).toBe("42501");
  });

  it("keeps email addresses private", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const rows = await asUser(user.id, (tx) => tx`select email from restix.profile_private where user_id = ${other.id}`);
    expect(rows).toHaveLength(0);
    // The public profiles table has no email column grant at all.
    expect(await outcome(asUser(user.id, (tx) => tx`select * from restix.profiles limit 1`))).toBe("42501");
  });

  it("does not let a user grant themselves a role", async () => {
    const user = await makeUser();
    expect(await outcome(asUser(user.id, (tx) => tx`
      insert into restix.admin_roles (user_id, role) values (${user.id}, 'admin')`))).toBe("42501");
  });

  it("lets moderators restrict other users but not change their own status", async () => {
    const mod = await makeUser({ role: "moderator" });
    const user = await makeUser();
    const rows = await asUser(mod.id, (tx) => tx`
      update restix.profiles set status = 'restricted', status_reason = 'test' where id = ${user.id} returning status`);
    expect(rows[0].status).toBe("restricted");
    expect(await outcome(asUser(mod.id, (tx) => tx`
      update restix.profiles set status = 'suspended' where id = ${mod.id}`))).toBe("42501");
  });
});

describe("inquiries", () => {
  it("lets an eligible buyer contact a seller about an active listing", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const rows = await asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Hi, is this still available?', 1) returning id`);
    expect(rows).toHaveLength(1);
  });

  it("refuses inquiries on paused listings, on your own listing and with a forged seller", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const paused = await makeListing(seller.id, { status: "paused" });
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${paused.listingId}, ${buyer.id}, ${seller.id}, 'Hi, is this still available?', 1)`))).toBe("42501");
    const own = await makeListing(seller.id);
    expect(await outcome(asUser(seller.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${own.listingId}, ${seller.id}, ${seller.id}, 'Talking to myself here', 1)`))).not.toBe("ok");
    const active = await makeListing(seller.id);
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${active.listingId}, ${buyer.id}, ${buyer.id}, 'Forged seller id here', 1)`))).not.toBe("ok");
  });

  it("allows one open inquiry per buyer per listing", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const send = () => asUser(buyer.id, (tx) => tx`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Hi, is this still available?', 1)`);
    await send();
    expect(await outcome(send())).toBe("23505");
  });

  it("shows an inquiry only to its buyer and seller, and only the seller can accept it", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const stranger = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const [inq] = await asUser(buyer.id, (tx) => tx<{ id: string }[]>`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Hi, is this still available?', 1) returning id`);
    expect(await asUser(stranger.id, (tx) => tx`select id from restix.inquiries where id = ${inq.id}`)).toHaveLength(0);
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      update restix.inquiries set status = 'accepted' where id = ${inq.id}`))).toBe("42501");
    expect(await outcome(asUser(buyer.id, (tx) => tx`
      update restix.inquiries set message = 'edited after the fact' where id = ${inq.id}`))).toBe("42501");
    const accepted = await asUser(seller.id, (tx) => tx`
      update restix.inquiries set status = 'accepted', seller_contact_shared = 'wa.me/91...', responded_at = now()
      where id = ${inq.id} returning status`);
    expect(accepted[0].status).toBe("accepted");
  });

  it("only lets the parties confirm an outcome, once each", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const stranger = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const [inq] = await asUser(buyer.id, (tx) => tx<{ id: string }[]>`
      insert into restix.inquiries (listing_id, buyer_id, seller_id, message, quantity_requested)
      values (${listingId}, ${buyer.id}, ${seller.id}, 'Hi, is this still available?', 1) returning id`);
    await asUser(seller.id, (tx) => tx`update restix.inquiries set status = 'accepted' where id = ${inq.id}`);
    const confirm = (uid: string, party: string) => asUser(uid, (tx) => tx`
      insert into restix.transaction_confirmations (inquiry_id, user_id, party, outcome)
      values (${inq.id}, ${uid}, ${party}, 'completed')`);
    expect(await outcome(confirm(buyer.id, "buyer"))).toBe("ok");
    expect(await outcome(confirm(buyer.id, "buyer"))).toBe("23505");
    expect(await outcome(confirm(buyer.id, "seller"))).not.toBe("ok");
    expect(await outcome(confirm(stranger.id, "buyer"))).toBe("42501");
  });
});

describe("reports and moderation", () => {
  it("sets report priority from the reason, not from the reporter", async () => {
    const reporter = await makeUser();
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const [r] = await asUser(reporter.id, (tx) => tx<{ priority: string }[]>`
      insert into restix.reports (reporter_id, listing_id, reason, priority) values (${reporter.id}, ${listingId}, 'spam', 'urgent')
      returning priority`);
    expect(r.priority).toBe("low");
  });

  it("blocks pre-resolved reports, duplicate open reports and reading other people's reports", async () => {
    const reporter = await makeUser();
    const other = await makeUser();
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await outcome(asUser(reporter.id, (tx) => tx`
      insert into restix.reports (reporter_id, listing_id, reason, status) values (${reporter.id}, ${listingId}, 'scam', 'resolved')`))).toBe("42501");
    const [report] = await asUser(reporter.id, (tx) => tx<{ id: string }[]>`
      insert into restix.reports (reporter_id, listing_id, reason) values (${reporter.id}, ${listingId}, 'scam') returning id`);
    expect(await outcome(asUser(reporter.id, (tx) => tx`
      insert into restix.reports (reporter_id, listing_id, reason) values (${reporter.id}, ${listingId}, 'spam')`))).toBe("23505");
    expect(await asUser(other.id, (tx) => tx`select id from restix.reports where id = ${report.id}`)).toHaveLength(0);
    expect(await asUser(seller.id, (tx) => tx`select id from restix.reports where id = ${report.id}`)).toHaveLength(0);
  });

  it("keeps the moderation log append-only and moderator-only", async () => {
    const user = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    expect(await outcome(asUser(user.id, (tx) => tx`
      insert into restix.moderation_actions (actor_id, action, reason) values (${user.id}, 'hide_listing', 'because')`))).toBe("42501");
    const [entry] = await asUser(mod.id, (tx) => tx<{ id: string }[]>`
      insert into restix.moderation_actions (actor_id, action, reason) values (${mod.id}, 'hide_listing', 'test entry') returning id`);
    expect(await outcome(asUser(mod.id, (tx) => tx`
      update restix.moderation_actions set reason = 'rewritten' where id = ${entry.id}`))).toBe("42501");
    expect(await outcome(asUser(mod.id, (tx) => tx`
      delete from restix.moderation_actions where id = ${entry.id}`))).toBe("42501");
    expect(await asUser(user.id, (tx) => tx`select id from restix.moderation_actions`)).toHaveLength(0);
  });

  it("does not let moderators forge another moderator as the actor", async () => {
    const mod = await makeUser({ role: "moderator" });
    const other = await makeUser({ role: "moderator" });
    expect(await outcome(asUser(mod.id, (tx) => tx`
      insert into restix.moderation_actions (actor_id, action, reason) values (${other.id}, 'hide_listing', 'framed')`))).toBe("42501");
  });
});

describe("analytics, rate limits and expiry", () => {
  it("lets only admins read analytics", async () => {
    await asSystem((tx) => tx`insert into restix.analytics_events (name) values ('landing_viewed')`);
    const user = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    expect(await asUser(user.id, (tx) => tx`select id from restix.analytics_events`)).toHaveLength(0);
    expect(await asUser(mod.id, (tx) => tx`select id from restix.analytics_events`)).toHaveLength(0);
    expect((await asUser(admin.id, (tx) => tx`select id from restix.analytics_events`)).length).toBeGreaterThan(0);
    expect(await outcome(asUser(user.id, (tx) => tx`insert into restix.analytics_events (name) values ('landing_viewed')`))).toBe("42501");
  });

  it("counts rate-limit hits atomically", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [r] = await asSystem((tx) => tx<{ ok: boolean }[]>`select restix.hit_rate_limit('test:bucket', 3, 3600) as ok`);
      results.push(r.ok);
    }
    expect(results).toEqual([true, true, true, false]);
    const user = await makeUser();
    expect(await outcome(asUser(user.id, (tx) => tx`select restix.hit_rate_limit('x', 1, 60)`))).toBe("42501");
  });

  it("purges analytics older than 18 months, and only the system can run it", async () => {
    await asSystem((tx) => tx`insert into restix.analytics_events (name, occurred_at) values
      ('landing_viewed', now() - interval '19 months'), ('landing_viewed', now() - interval '17 months')`);
    const [{ result }] = await asSystem((tx) => tx<{ result: { analyticsDeleted?: number; analytics_deleted: number } }[]>`select restix.purge_old_data() as result`);
    expect(result.analytics_deleted).toBeGreaterThanOrEqual(1);
    const [{ old }] = await asSystem((tx) => tx<{ old: number }[]>`
      select count(*)::int as old from restix.analytics_events where occurred_at < now() - interval '18 months'`);
    expect(old).toBe(0);
    const user = await makeUser({ role: "admin" });
    expect(await outcome(asUser(user.id, (tx) => tx`select restix.purge_old_data()`))).toBe("42501");
  });

  it("expires overdue listings", async () => {
    const seller = await makeUser();
    const { listingId } = await makeListing(seller.id);
    await asSystem((tx) => tx`update restix.ticket_listings set expires_at = now() - interval '1 minute', version = version + 1 where id = ${listingId}`);
    await asSystem((tx) => tx`select restix.expire_listings()`);
    const [row] = await asSystem((tx) => tx`select status from restix.ticket_listings where id = ${listingId}`);
    expect(row.status).toBe("expired");
  });
});

describe("saved listings", () => {
  const save = (userId: string, forUser: string, listingId: string) =>
    asUser(userId, (tx) => tx`insert into restix.saved_listings (user_id, listing_id) values (${forUser}, ${listingId})`);

  it("lets a student save someone else's live listing, and only they can see or remove it", async () => {
    const seller = await makeUser();
    const me = await makeUser();
    const other = await makeUser();
    const { listingId } = await makeListing(seller.id);
    expect(await outcome(save(me.id, me.id, listingId))).toBe("ok");
    for (const who of [seller, other]) {
      expect(await asUser(who.id, (tx) => tx`select 1 from restix.saved_listings where listing_id = ${listingId}`)).toHaveLength(0);
      await asUser(who.id, (tx) => tx`delete from restix.saved_listings where user_id = ${me.id}`);
    }
    expect(await asUser(me.id, (tx) => tx`select 1 from restix.saved_listings`)).toHaveLength(1);
  });

  it("refuses saving for someone else, your own listing, or a listing you can't see", async () => {
    const seller = await makeUser();
    const me = await makeUser();
    const { listingId } = await makeListing(seller.id);
    const draft = await makeListing(seller.id, { status: "draft" });
    expect(await outcome(save(me.id, seller.id, listingId))).toBe("42501");
    expect(await outcome(save(seller.id, seller.id, listingId))).toBe("42501");
    expect(await outcome(save(me.id, me.id, draft.listingId))).toBe("42501");
    const banned = await makeUser({ status: "suspended" });
    expect(await outcome(save(banned.id, banned.id, listingId))).toBe("42501");
  });
});
