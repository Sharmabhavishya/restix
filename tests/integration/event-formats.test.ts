// Events say what kind of ticket they have and which levels (e.g. Normal, Fan pit); student
// requests carry both, and approving one publishes it exactly as asked, straight away.
import { describe, expect, it } from "vitest";
import { college, db, makeEvent, makeUser, outcome } from "./helpers";

const admin = await import("@/server/event-admin");
const events = await import("@/server/events");
const { asUser, asSystem } = db;

const soon = () => new Date(Date.now() + 10 * 86_400_000);

describe("event ticket format and levels", () => {
  it("publishes a request with its format and levels, and it can be sold at once", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    expect(await admin.suggestEvent(student.id, {
      name: "Freshers Night Out", startsAt: soon(), venue: "Main lawn", category: "party", details: null,
      ticketFormat: "qr", ticketTypes: ["Normal", "Fan pit"],
    })).toEqual({ ok: true });
    const [req] = await admin.mySuggestions(student.id);
    expect(req).toMatchObject({ ticketFormat: "qr", ticketTypes: ["Normal", "Fan pit"] });
    // The moderator sees exactly what was asked for before approving.
    expect((await admin.openSuggestions(mod.id)).find((s) => s.id === req.id)).toMatchObject({ ticketFormat: "qr", ticketTypes: ["Normal", "Fan pit"] });

    const r = await admin.approveSuggestion(mod.id, req.id, null);
    expect(r.ok).toBe(true);
    // Live the moment it's approved: the student can list for it straight away, with the event's format and levels.
    const sellable = (await events.listableEvents(student.id)).find((e) => e.name === "Freshers Night Out");
    expect(sellable).toMatchObject({ ticketFormat: "qr" });
    expect(sellable!.ticketTypes.map((t) => t.name)).toEqual(["Normal", "Fan pit"]);
    const detail = await events.getEventBySlug(student.id, (r as { slug: string }).slug);
    expect(detail).toMatchObject({ ticketFormat: "qr", transferPolicy: "allowed", status: "scheduled" });
  });

  it("gives a request without levels a single level, and leaves the format to sellers when not given", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    await admin.suggestEvent(student.id, { name: "Quiet Quiz", startsAt: soon(), venue: null, category: null, details: null, ticketFormat: null, ticketTypes: [] });
    const [req] = await admin.mySuggestions(student.id);
    const r = await admin.approveSuggestion(mod.id, req.id, null);
    const ev = await events.getEventBySlug(student.id, (r as { slug: string }).slug);
    expect(ev?.ticketFormat).toBeNull();
    expect(ev?.ticketTypes.map((t) => t.name)).toEqual(["General"]);
  });

  it("cleans the levels a student types", async () => {
    const parsed = admin.suggestionInput.parse({ name: "Gig", ticketTypes: ["Fan pit", " Gold  stand, Silver", "fan PIT", ""] });
    expect(parsed.ticketTypes).toEqual(["Fan pit", "Gold stand", "Silver"]);
    expect(admin.suggestionInput.safeParse({ name: "Gig", ticketFormat: "hologram" }).success).toBe(false);
    expect(admin.suggestionInput.parse({ name: "Gig", ticketFormat: "" }).ticketFormat).toBeNull();
  });

  it("stores the format a moderator sets on an event, and lets them change or clear it", async () => {
    const mod = await makeUser({ role: "moderator" });
    const base = {
      name: "Format Fest", slug: `format-fest-${Date.now().toString(36)}`, category: "fest" as const, venue: null, description: null,
      startsAt: soon(), endsAt: null, status: "scheduled" as const, transferPolicy: "allowed" as const, policySource: null,
      ticketTypes: [{ name: "Normal", faceValuePaise: 50000 }, { name: "Fan pit", faceValuePaise: 90000 }], reason: "Announced today",
    };
    const made = await admin.saveEvent(mod.id, await college(), { ...base, ticketFormat: "wristband" });
    expect(made).toMatchObject({ ok: true });
    const id = (made as { id: string }).id;
    expect((await admin.eventForEdit(mod.id, id))?.ticketFormat).toBe("wristband");
    await admin.saveEvent(mod.id, await college(), { ...base, ticketFormat: null, reason: "Mixed tickets after all" }, id);
    expect((await admin.eventForEdit(mod.id, id))?.ticketFormat).toBeNull();
  });
});

describe("database rules for the new columns", () => {
  it("won't let a student set an event's ticket format", async () => {
    const student = await makeUser();
    const { eventId } = await makeEvent();
    const rows = await asUser(student.id, (tx) => tx`update restix.events set ticket_format = 'qr' where id = ${eventId} returning id`);
    expect(rows).toHaveLength(0);
  });

  it("only accepts real ticket formats and a sensible number of levels", async () => {
    const student = await makeUser();
    const { eventId } = await makeEvent();
    expect(await outcome(asSystem((tx) => tx`update restix.events set ticket_format = 'hologram' where id = ${eventId}`))).toBe("23514");
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name, ticket_format) values (${student.id}, 'Bad format', 'hologram')`))).toBe("23514");
    const tooMany = Array.from({ length: 13 }, (_, i) => `Level ${i}`);
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name, ticket_types) values (${student.id}, 'Too many', ${tooMany})`))).toBe("23514");
  });

  it("keeps a student's requested levels private to them and their moderators", async () => {
    const student = await makeUser();
    const other = await makeUser();
    await admin.suggestEvent(student.id, { name: "Private levels", startsAt: soon(), venue: null, category: null, details: null, ticketFormat: "pass", ticketTypes: ["VIP"] });
    const seen = await asUser(other.id, (tx) => tx`select id from restix.event_suggestions where name = 'Private levels'`);
    expect(seen).toHaveLength(0);
  });
});
