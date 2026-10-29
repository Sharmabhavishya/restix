import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { db, makeEvent, makeUser } from "./helpers";

const covers = await import("@/server/event-covers");
const events = await import("@/server/events");
const { asSystem } = db;

async function photo(width: number, height: number, type: "jpeg" | "png" = "jpeg") {
  const img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } });
  const buf = type === "jpeg"
    ? await img.jpeg().withExif({ IFD0: { Make: "PhoneCo" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "28/1 31/1 0/1" } }).toBuffer()
    : await img.png().toBuffer();
  return new File([new Uint8Array(buf)], `p.${type}`, { type: `image/${type}` });
}

describe("event covers", () => {
  it("turns a photo into a capped WebP with no metadata and a blur placeholder", async () => {
    const r = await covers.processCover(await photo(3000, 2000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const meta = await sharp(r.cover.image).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1600, 1067]);
    expect(meta.exif).toBeUndefined();
    expect(r.cover.blur).toMatch(/^data:image\/webp;base64,/);
  });

  it("refuses empty, fake, tiny, oversized and non-image files", async () => {
    expect((await covers.processCover(new File([], "x.png", { type: "image/png" }))).ok).toBe(false);
    expect((await covers.processCover(new File(["<svg onload=alert(1)>"], "x.svg", { type: "image/svg+xml" }))).ok).toBe(false);
    expect((await covers.processCover(new File(["not really a png"], "x.png", { type: "image/png" }))).ok).toBe(false);
    expect((await covers.processCover(await photo(150, 900, "png"))).ok).toBe(false);
    expect((await covers.processCover(new File([new Uint8Array(covers.MAX_UPLOAD_BYTES + 1)], "big.jpg", { type: "image/jpeg" }))).ok).toBe(false);
  });

  it("lets a moderator set and replace a cover, which students of the college see and others don't", async () => {
    const mod = await makeUser({ role: "moderator" });
    const student = await makeUser();
    const { eventId } = await makeEvent();
    const r = await covers.processCover(await photo(1200, 800));
    if (!r.ok) throw new Error(r.error);
    expect(await covers.setCover(mod.id, eventId, r.cover)).toEqual({ ok: true });
    const first = (await covers.coverImage(student.id, eventId))!.version;
    expect(await covers.setCover(mod.id, eventId, r.cover)).toEqual({ ok: true });
    const seen = await covers.coverImage(student.id, eventId);
    // Every replacement gets a strictly higher version, so cached copies can never be mistaken for the new one,
    // even after the cover is removed and added again.
    expect(seen!.version).toBeGreaterThan(first);
    await covers.removeCover(mod.id, eventId);
    expect(await covers.setCover(mod.id, eventId, r.cover)).toEqual({ ok: true });
    const again = (await covers.coverImage(student.id, eventId))!.version;
    expect(again).toBeGreaterThan(seen!.version);
    const listed = (await events.listUpcomingEvents(student.id)).find((e) => e.id === eventId);
    expect(listed?.coverVersion).toBe(again);
    expect(listed?.coverBlur).toMatch(/^data:image\/webp/);

    // A student can't set one, and another college can't see it.
    expect((await covers.setCover(student.id, eventId, r.cover)).ok).toBe(false);
    const away = await asSystem(async (tx) => {
      const [c] = await tx<{ id: string }[]>`insert into restix.colleges (slug, name, short_name) values (${"cv-" + randomUUID().slice(0, 8)}, 'Away', 'AW') returning id`;
      return c.id;
    });
    const outsider = await makeUser({ collegeId: away });
    expect(await covers.coverImage(outsider.id, eventId)).toBeNull();

    await covers.removeCover(student.id, eventId); // no effect: not a moderator
    expect(await covers.coverImage(student.id, eventId)).not.toBeNull();
    await covers.removeCover(mod.id, eventId);
    expect(await covers.coverImage(student.id, eventId)).toBeNull();
  });
});
