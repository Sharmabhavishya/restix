import "server-only";
import { asUser, pgCode, PG, type Tx } from "./db";
import { allow } from "./rate-limit";

// "I want a ticket" for an event. Private: people see how many are looking, never who.

export async function setWant(viewerId: string, eventId: string, want: boolean): Promise<{ ok: true; wanted: boolean } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false, error: "Event not found." };
  if (!(await allow("save", viewerId))) return { ok: false, error: "Slow down a little. Try again in a few minutes." };
  try {
    await asUser(viewerId, (tx) =>
      want
        ? tx`insert into restix.event_wants (user_id, event_id) values (${viewerId}, ${eventId}) on conflict do nothing`
        : tx`delete from restix.event_wants where user_id = ${viewerId} and event_id = ${eventId}`,
    );
    return { ok: true, wanted: want };
  } catch (err) {
    if (pgCode(err) === PG.rlsViolation) return { ok: false, error: "You can't do that for this event." };
    console.error("want failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save. Try again." };
  }
}

/** How many students want each event, and which of them the viewer wants. */
export async function wantsFor(tx: Tx, viewerId: string, eventIds: string[]): Promise<{ counts: Map<string, number>; mine: Set<string> }> {
  if (eventIds.length === 0) return { counts: new Map(), mine: new Set() };
  const [counts, mine] = await Promise.all([
    tx<{ eventId: string; wants: number }[]>`select event_id, wants from restix.event_want_counts(${eventIds}::uuid[])`,
    tx<{ eventId: string }[]>`select event_id from restix.event_wants where user_id = ${viewerId} and event_id = any(${eventIds}::uuid[])`,
  ]);
  return { counts: new Map(counts.map((r) => [r.eventId, r.wants])), mine: new Set(mine.map((r) => r.eventId)) };
}
