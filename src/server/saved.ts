import "server-only";
import { asUser, pgCode, PG } from "./db";
import { track } from "./analytics";
import { allow } from "./rate-limit";

/** A watchlist has to stay a list someone can read. */
export const MAX_SAVED = 100;

export type SaveResult = { ok: true; saved: boolean } | { ok: false; error: string };

/**
 * Saves or unsaves a listing for the viewer. RLS decides what can be saved (live listings the
 * viewer can see, never their own); this adds the rate limit and the size cap.
 */
export async function setSaved(viewerId: string, listingId: string, save: boolean): Promise<SaveResult> {
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return { ok: false, error: "Listing not found." };
  if (!(await allow("save", viewerId))) return { ok: false, error: "Slow down a little. Try again in a few minutes." };
  try {
    const result = await asUser(viewerId, async (tx): Promise<SaveResult> => {
      if (!save) {
        await tx`delete from restix.saved_listings where user_id = ${viewerId} and listing_id = ${listingId}`;
        return { ok: true, saved: false };
      }
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from restix.saved_listings where user_id = ${viewerId}`;
      if (n >= MAX_SAVED) return { ok: false, error: `You can save up to ${MAX_SAVED} listings. Unsave a few first.` };
      await tx`insert into restix.saved_listings (user_id, listing_id) values (${viewerId}, ${listingId})
               on conflict (user_id, listing_id) do nothing`;
      return { ok: true, saved: true };
    });
    if (result.ok && result.saved) await track("listing_saved", { userId: viewerId, listingId });
    return result;
  } catch (err) {
    if (pgCode(err) === PG.rlsViolation) return { ok: false, error: "You can only save live listings from other students." };
    console.error("save failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
}

export async function savedCount(viewerId: string): Promise<number> {
  const [{ n }] = await asUser(viewerId, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n from restix.saved_listings s
    join restix.ticket_listings l on l.id = s.listing_id
    where s.user_id = ${viewerId} and l.status = 'active' and l.expires_at > now()`);
  return n;
}
