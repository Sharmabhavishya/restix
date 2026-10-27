import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db, makeUser, outcome } from "./helpers";

const admin = await import("@/server/event-admin");
const { asUser, asSystem } = db;

describe("event suggestions", () => {
  it("lets a student suggest an event and a moderator of the same college decide it", async () => {
    const student = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    expect(await admin.suggestEvent(student.id, { name: "Battle of Bands", happensOn: "2026-12-01", details: null })).toEqual({ ok: true });
    const [mine] = await admin.mySuggestions(student.id);
    expect(mine).toMatchObject({ name: "Battle of Bands", status: "open" });
    const queue = await admin.openSuggestions(mod.id);
    const s = queue.find((q) => q.id === mine.id)!;
    expect(s.suggestedByName).toBeTruthy();
    expect(await admin.decideSuggestion(mod.id, { id: s.id, status: "added", note: "Added with its resale rules" })).toEqual({ ok: true });
    expect((await admin.mySuggestions(student.id))[0]).toMatchObject({ status: "added", moderatorNote: "Added with its resale rules" });
  });

  it("won't let a student pre-approve, read others' suggestions or decide them", async () => {
    const student = await makeUser();
    const other = await makeUser();
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name, status) values (${student.id}, 'Sneaky', 'added')`))).toBe("42501");
    expect(await outcome(asUser(student.id, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name) values (${other.id}, 'In your name')`))).toBe("42501");
    await admin.suggestEvent(other.id, { name: "Private suggestion", happensOn: null, details: null });
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
    await admin.suggestEvent(student.id, { name: "Home college event", happensOn: null, details: null });
    expect((await admin.openSuggestions(foreignMod.id)).map((s) => s.name)).not.toContain("Home college event");
    expect(await asUser(foreignMod.id, (tx) => tx`
      update restix.event_suggestions set status = 'declined' where suggested_by = ${student.id} returning id`)).toHaveLength(0);
  });
});
