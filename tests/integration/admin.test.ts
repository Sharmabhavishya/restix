import { describe, expect, it } from "vitest";
import { db, makeEvent, makeListing, makeUser } from "./helpers";

const admin = await import("@/server/admin");
const { asSystem } = db;

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
