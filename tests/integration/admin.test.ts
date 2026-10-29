import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser } from "./helpers";

const admin = await import("@/server/admin");
const profile = await import("@/server/profile");
const { asSystem } = db;

// A college of its own, so counts in these tests aren't affected by other test files.
async function freshCollege() {
  return asSystem(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      insert into restix.colleges (slug, name, short_name) values (${"c-" + randomUUID().slice(0, 8)}, 'Test College', 'TC') returning id`;
    return c.id;
  });
}

describe("admin tools", () => {
  it("deletes an event only for an admin who types its name, and logs it", async () => {
    const seller = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const boss = await makeUser({ role: "admin" });
    const { eventId, ticketTypeId } = await makeEvent();
    await makeListing(seller.id, { eventId, ticketTypeId });

    expect(await admin.deleteEvent(mod.id, { eventId, confirmName: "Test Event", reason: "Duplicate event" }))
      .toEqual({ ok: false, error: "Only admins can delete events." });
    expect(await admin.deleteEvent(boss.id, { eventId, confirmName: "Wrong name", reason: "Duplicate event" }))
      .toEqual({ ok: false, error: "Type the event's name exactly to confirm." });
    expect(await admin.deleteEvent(boss.id, { eventId, confirmName: "test event ", reason: "Duplicate event" }))
      .toMatchObject({ ok: true, message: "Deleted Test Event and its 1 listing." });

    const [log] = await asSystem((tx) => tx<{ action: string; metadata: { name: string } }[]>`
      select action, metadata from restix.moderation_actions where actor_id = ${boss.id} order by created_at desc limit 1`);
    expect(log).toMatchObject({ action: "delete_event", metadata: { name: "Test Event" } });
  });

  it("exports every account with contact details, for admins only, and logs the export", async () => {
    const student = await makeUser();
    await asSystem((tx) => tx`update restix.profile_private set whatsapp_number = '+919876543210' where user_id = ${student.id}`);
    const mod = await makeUser({ role: "moderator" });
    const boss = await makeUser({ role: "admin" });

    expect(await admin.exportAccounts(mod.id)).toBeNull();
    const rows = (await admin.exportAccounts(boss.id))!;
    expect(rows.find((r) => r.email === student.email)).toMatchObject({ whatsappNumber: "+919876543210", status: "active", role: null });
    expect(rows.find((r) => r.email === mod.email)?.role).toBe("moderator");

    const [log] = await asSystem((tx) => tx<{ action: string }[]>`
      select action from restix.moderation_actions where actor_id = ${boss.id} order by created_at desc limit 1`);
    expect(log.action).toBe("export_users");
  });

  it("shows the team and the dashboard to moderators", async () => {
    const mod = await makeUser({ role: "moderator" });
    const members = await admin.team(mod.id);
    expect(members.some((m) => m.id === mod.id && m.role === "moderator")).toBe(true);
    const d = await admin.dashboard(mod.id);
    expect(d.numbers.users).toBeGreaterThan(0);
    expect(d.newest.length).toBeGreaterThan(0);
  });
});

describe("accounts directory", () => {
  it("lists everyone with their details, filters and pages", async () => {
    const college = await freshCollege();
    const boss = await makeUser({ role: "admin", collegeId: college });
    const mod = await makeUser({ role: "moderator", collegeId: college });
    const flagged = await makeUser({ status: "restricted", collegeId: college });
    const student = await makeUser({ collegeId: college });
    await asSystem((tx) => tx`update restix.profile_private set whatsapp_number = '+919811122233' where user_id = ${student.id}`);

    const all = await admin.listAccounts(boss.id, { q: "", show: "all", page: 1 });
    expect(all.total).toBe(4);
    expect(all.rows.find((r) => r.id === student.id)).toMatchObject({ email: student.email, whatsappNumber: "+919811122233", status: "active", role: null, listings: 0 });
    expect((await admin.listAccounts(boss.id, { q: "", show: "team", page: 1 })).rows.map((r) => r.id).sort()).toEqual([boss.id, mod.id].sort());
    expect((await admin.listAccounts(boss.id, { q: "", show: "flagged", page: 1 })).rows.map((r) => r.id)).toEqual([flagged.id]);
    expect((await admin.listAccounts(boss.id, { q: student.email.slice(0, 13), show: "all", page: 1 })).total).toBe(1);
    expect((await admin.listAccounts(boss.id, { q: "", show: "all", page: 2 })).rows).toHaveLength(0);
  });
});

describe("test events", () => {
  it("adds labelled sample events with every kind of rule, only for admins, then clears them", async () => {
    const college = await freshCollege();
    const boss = await makeUser({ role: "admin", collegeId: college });
    const mod = await makeUser({ role: "moderator", collegeId: college });

    expect(await admin.createTestEvents(mod.id)).toEqual({ ok: false, error: "Only admins can add test events." });
    expect(await admin.createTestEvents(boss.id)).toMatchObject({ ok: true });
    expect(await admin.testEventCount(boss.id)).toBe(6);
    const events = await asSystem((tx) => tx<{ name: string; isFixture: boolean; types: number; startsAt: Date }[]>`
      select e.name, e.is_fixture, e.starts_at, (select count(*)::int from restix.ticket_types t where t.event_id = e.id) as types
      from restix.events e where e.college_id = ${college}`);
    expect(events).toHaveLength(6);
    expect(events.every((e) => e.isFixture && e.name.startsWith("[Test] ") && e.types >= 1 && e.startsAt.getTime() > Date.now())).toBe(true);

    // A cap, so repeated clicks can't flood the site.
    for (let i = 0; i < 4; i++) await admin.createTestEvents(boss.id);
    expect(await admin.testEventCount(boss.id)).toBe(30);
    expect(await admin.createTestEvents(boss.id)).toMatchObject({ ok: false });

    expect(await admin.removeTestEvents(mod.id)).toEqual({ ok: false, error: "Only admins can remove test events." });
    expect(await admin.removeTestEvents(boss.id)).toEqual({ ok: true, message: "Removed 30 test events." });
    expect(await admin.testEventCount(boss.id)).toBe(0);
    expect(await admin.removeTestEvents(boss.id)).toEqual({ ok: false, error: "There are no test events to remove." });
  });
});

describe("the last admin", () => {
  it("can't delete their own account while no other admin is left in the college", async () => {
    const college = await freshCollege();
    const boss = await makeUser({ role: "admin", collegeId: college });
    expect(await profile.deleteAccount(boss.id)).toEqual({ ok: false, error: "You're the only admin, so this account can't be deleted." });
    await makeUser({ role: "admin", collegeId: college });
    expect(await profile.deleteAccount(boss.id)).toEqual({ ok: true });
  });
});
