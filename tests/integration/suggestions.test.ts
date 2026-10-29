import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeUser, outcome } from "./helpers";

const admin = await import("@/server/event-admin");
const events = await import("@/server/events");
const { asUser, asSystem } = db;

describe("event suggestions", () => {
  it("lets a student suggest an event and a moderator of the same college decide it", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    expect(await admin.suggestEvent(student.id, { name: "Battle of Bands", startsAt: new Date("2026-12-01T13:30:00Z"), venue: null, category: "concert", details: null, ticketFormat: null, ticketTypes: [] })).toEqual({ ok: true });
    const [mine] = await admin.mySuggestions(student.id);
    expect(mine).toMatchObject({ name: "Battle of Bands", status: "open" });
    const queue = await admin.openSuggestions(mod.id);
    const s = queue.find((q) => q.id === mine.id)!;
    expect(s.suggestedByName).toBeTruthy();
    expect(await admin.decideSuggestion(mod.id, { id: s.id, status: "added", note: "Added with its resale rules" })).toEqual({ ok: true });
    expect((await admin.mySuggestions(student.id))[0]).toMatchObject({ status: "added", moderatorNote: "Added with its resale rules" });
  });

  it("publishes a request in one step: the event goes live, open to resale, and only for its college", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const startsAt = new Date(Date.now() + 9 * 86_400_000);
    await admin.suggestEvent(student.id, { name: "Rooftop Jam!! (Vol. 2)", startsAt, venue: "Block C roof", category: "party", details: "Open mic", ticketFormat: null, ticketTypes: [] });
    const [req] = await admin.mySuggestions(student.id);
    expect(req).toMatchObject({ venue: "Block C roof", category: "party", happensOn: expect.any(String) });

    // Not visible to students before approval: it's a request, not an event.
    expect((await events.listUpcomingEvents(student.id)).map((e) => e.name)).not.toContain("Rooftop Jam!! (Vol. 2)");

    expect((await admin.approveSuggestion(student.id, req.id, null)).ok).toBe(false); // students can't approve
    const r = await admin.approveSuggestion(mod.id, req.id, "See you there");
    expect(r.ok).toBe(true);
    const slug = (r as { slug: string }).slug;
    expect(slug).toMatch(/^rooftop-jam-vol-2-[a-z0-9]{1,4}$/);
    const ev = await events.getEventBySlug(student.id, slug);
    expect(ev).toMatchObject({ name: "Rooftop Jam!! (Vol. 2)", venue: "Block C roof", category: "party", transferPolicy: "allowed", status: "scheduled" });
    expect(ev!.ticketTypes.map((t) => t.name)).toEqual(["General"]);
    expect((await events.listableEvents(student.id)).map((e) => e.id)).toContain(ev!.id);
    expect((await admin.mySuggestions(student.id))[0]).toMatchObject({ status: "added", moderatorNote: "See you there" });
    // Twice is refused, and it's in the log.
    expect((await admin.approveSuggestion(mod.id, req.id, null)).ok).toBe(false);
    const log = await asSystem((tx) => tx`select action from restix.moderation_actions where event_id = ${ev!.id}`);
    expect(log.map((l) => l.action)).toEqual(["create_event"]);
  });

  it("won't publish a request without a date, or one that's already in the past", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    await admin.suggestEvent(student.id, { name: "Someday", startsAt: null, venue: null, category: null, details: null, ticketFormat: null, ticketTypes: [] });
    const [req] = await admin.mySuggestions(student.id);
    expect(await admin.approveSuggestion(mod.id, req.id, null)).toMatchObject({ ok: false, error: expect.stringMatching(/no date/) });
    await asSystem((tx) => tx`update restix.event_suggestions set starts_at = now() - interval '1 day' where id = ${req.id}`);
    expect(await admin.approveSuggestion(mod.id, req.id, null)).toMatchObject({ ok: false, error: expect.stringMatching(/passed/) });
  });

  it("checks request input: past dates, junk categories, long names", () => {
    expect(admin.suggestionInput.safeParse({ name: "Old", startsAt: "2020-01-01T19:00" }).success).toBe(false);
    expect(admin.suggestionInput.safeParse({ name: "Odd", category: "rave" }).data?.category).toBeNull();
    expect(admin.suggestionInput.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(admin.suggestionInput.safeParse({ name: "  " }).success).toBe(false);
    expect(admin.suggestionInput.safeParse({ name: "होली मिलन 🎉" }).success).toBe(true);
  });

  it("won't let a student pre-approve, read others' suggestions or decide them", async () => {
    const student = await makeUser();
    const other = await makeUser();
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name, status) values (${student.id}, 'Sneaky', 'added')`))).toBe("42501");
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name) values (${other.id}, 'In your name')`))).toBe("42501");
    await admin.suggestEvent(other.id, { name: "Private suggestion", startsAt: null, venue: null, category: null, details: null, ticketFormat: null, ticketTypes: [] });
    expect(await asUser(student.id, (tx) => tx`select id from restix.event_suggestions where suggested_by = ${other.id}`)).toHaveLength(0);
    expect(await asUser(student.id, (tx) => tx`
      update restix.event_suggestions set status = 'added' where suggested_by = ${other.id} returning id`)).toHaveLength(0);
  });

  it("keeps suggestions inside their college", async () => {
    const elsewhere = await asSystem(async (tx) => {
      const [c] = await tx<{ id: string }[]>`
        insert into restix.colleges (slug, name, short_name) values (${"s-" + randomUUID().slice(0, 8)}, 'Elsewhere', 'EW') returning id`;
      return c.id;
    });
    const foreignMod = await makeUser({ role: "admin", collegeId: elsewhere });
    const student = await makeUser();
    await admin.suggestEvent(student.id, { name: "Home college event", startsAt: null, venue: null, category: null, details: null, ticketFormat: null, ticketTypes: [] });
    expect((await admin.openSuggestions(foreignMod.id)).map((s) => s.name)).not.toContain("Home college event");
    expect(await asUser(foreignMod.id, (tx) => tx`
      update restix.event_suggestions set status = 'declined' where suggested_by = ${student.id} returning id`)).toHaveLength(0);
  });
});
