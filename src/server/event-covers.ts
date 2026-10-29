import "server-only";
import sharp from "sharp";
import { asUser, pgCode, PG } from "./db";

// Event cover images. Whatever comes in (a phone photo, a poster PNG) leaves as one WebP at most
// 1600px on its long side, upright, with all metadata dropped, plus a 24px blurred placeholder.

/** The most we'll even try to decode. The browser already shrinks covers before upload. */
export const MAX_UPLOAD_BYTES = 1_400_000;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export interface Cover {
  image: Buffer;
  width: number;
  height: number;
  blur: string;
}

export type CoverResult<T> = { ok: true } & T | { ok: false; error: string };

/** Turns an uploaded file into a cover, or says plainly why it can't. */
export async function processCover(file: File): Promise<CoverResult<{ cover: Cover }>> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "That image is too big. Use one under 1.4 MB." };
  if (!ACCEPTED.has(file.type)) return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // limitInputPixels stops decompression bombs; failOn catches truncated or fake files.
    const base = sharp(input, { limitInputPixels: 40_000_000, failOn: "error", animated: false }).rotate();
    const meta = await base.metadata();
    // The browser-reported type is only a hint; what the bytes really are decides.
    if (!meta.format || !["jpeg", "png", "webp", "avif", "gif"].includes(meta.format)) {
      return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
    }
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 200) {
      return { ok: false, error: "That image is too small. Use one at least 200px on each side." };
    }
    const { data, info } = await base
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const tiny = await sharp(data).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
    return { ok: true, cover: { image: data, width: info.width, height: info.height, blur: `data:image/webp;base64,${tiny.toString("base64")}` } };
  } catch {
    return { ok: false, error: "That file isn't an image we can read." };
  }
}

/** Sets or replaces an event's cover. RLS limits this to moderators of the event's college. */
export async function setCover(modId: string, eventId: string, cover: Cover): Promise<CoverResult<object>> {
  try {
    await asUser(modId, (tx) => tx`
      insert into restix.event_covers (event_id, image, width, height, blur, updated_by, version)
      values (${eventId}, ${cover.image}, ${cover.width}, ${cover.height}, ${cover.blur}, ${modId}, nextval('restix.event_cover_version_seq')::int)
      on conflict (event_id) do update set image = excluded.image, width = excluded.width, height = excluded.height,
        blur = excluded.blur, updated_by = excluded.updated_by, updated_at = now(),
        version = excluded.version`);
    return { ok: true };
  } catch (err) {
    if (pgCode(err) === PG.rlsViolation) return { ok: false, error: "You can't change this event's cover." };
    console.error("cover save failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "The cover wasn't saved because of a server error." };
  }
}

export async function removeCover(modId: string, eventId: string): Promise<void> {
  await asUser(modId, (tx) => tx`delete from restix.event_covers where event_id = ${eventId}`);
}

/** The cover for the route handler, read as the viewer so RLS decides who may see it. */
export async function coverImage(viewerId: string, eventId: string): Promise<{ image: Buffer; version: number } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const [row] = await asUser(viewerId, (tx) => tx<{ image: Buffer; version: number }[]>`
    select image, version from restix.event_covers where event_id = ${eventId}`);
  return row ?? null;
}

/** Where a cover is served from; the version busts caches when it changes. */
export function coverUrl(eventId: string, version: number): string {
  return `/event-cover/${eventId}?v=${version}`;
}
