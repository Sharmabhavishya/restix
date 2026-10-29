import "server-only";
import { z } from "zod";
import { cleanText } from "@/lib/validation";
import { parseRupees } from "@/lib/money";
import { fromLocalInput } from "@/lib/format";
import { asUser, pgCode, PG } from "./db";
import { allow } from "./rate-limit";

// Event management for moderators. Events are open to resale at any price by default; a
// moderator can add a restriction (face value only, or no resale) per event. Every change is
// written to the moderation log.

export const EVENT_CATEGORIES = { fest: "Fest", concert: "Concert", party: "Party", prom: "Prom", workshop: "Workshop", sports: "Sports", other: "Other" } as const;

export const eventInput = z
  .object({
    name: z.string().transform(cleanText).pipe(z.string().min(2, "Name the event.").max(120)),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,80}$/, "Use lowercase letters, numbers and hyphens."),
    category: z.enum(Object.keys(EVENT_CATEGORIES) as [keyof typeof EVENT_CATEGORIES, ...(keyof typeof EVENT_CATEGORIES)[]]),
    venue: z.string().transform(cleanText).pipe(z.string().max(120)).optional().transform((v) => v || null),
    description: z.string().transform(cleanText).pipe(z.string().max(2000)).optional().transform((v) => v || null),
    startsAt: z.string().transform((v, ctx) => {
      const d = fromLocalInput(v);
      if (!d) { ctx.addIssue({ code: "custom", message: "Enter the start date and time." }); return z.NEVER; }
      return d;
    }),
    endsAt: z.string().optional().transform((v, ctx) => {
      if (!v) return null;
      const d = fromLocalInput(v);
      if (!d) { ctx.addIssue({ code: "custom", message: "Enter a valid end time." }); return z.NEVER; }
      return d;
    }),
    status: z.enum(["scheduled", "postponed", "cancelled", "completed"]),
    // Optional in the form: no restriction chosen means resale is allowed at any price.
    transferPolicy: z.preprocess((v) => v || "allowed", z.enum(["allowed", "face_value_only", "prohibited", "unknown"])),
    policySource: z.string().transform(cleanText).pipe(z.string().max(300)).optional().transform((v) => v || null),
    ticketTypes: z.string().optional().transform((v, ctx) => {
      // One per line: "Night pass, 800" (face value optional)
      const lines = (v ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const out: { name: string; faceValuePaise: number | null }[] = [];
      for (const line of lines) {
        const [rawName, rawPrice] = line.split(",").map((s) => s.trim());
        const name = cleanText(rawName ?? "");
        if (!name || name.length > 60) { ctx.addIssue({ code: "custom", message: `Ticket type "${line}" needs a name under 60 characters.` }); return z.NEVER; }
        const price = rawPrice ? parseRupees(rawPrice) : null;
        if (rawPrice && price === null) { ctx.addIssue({ code: "custom", message: `"${rawPrice}" isn't a valid price.` }); return z.NEVER; }
        out.push({ name, faceValuePaise: price });
      }
      return out;
    }),
    reason: z.string().transform(cleanText).pipe(z.string().min(3, "Say briefly why (it goes in the moderation log).").max(1000)),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], message: "The end must be after the start." });
export type EventInput = z.output<typeof eventInput>;

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function saveEvent(modId: string, collegeId: string, input: EventInput, eventId?: string): Promise<Result> {
  try {
    return await asUser(modId, async (tx): Promise<Result> => {
      let id = eventId;
      let before: Record<string, unknown> = {};
      if (id) {
        const [prev] = await tx<{ status: string; transferPolicy: string }[]>`
          select status, transfer_policy from restix.events where id = ${id} for update`;
        if (!prev) return { ok: false, error: "Event not found." };
        before = prev;
        await tx`update restix.events set name = ${input.name}, slug = ${input.slug}, category = ${input.category},
                   venue = ${input.venue}, description = ${input.description}, starts_at = ${input.startsAt},
                   ends_at = ${input.endsAt}, status = ${input.status}, transfer_policy = ${input.transferPolicy},
                   policy_source = ${input.policySource},
                   policy_updated_at = case when transfer_policy <> ${input.transferPolicy} or policy_source is distinct from ${input.policySource}
                                            then now() else policy_updated_at end
                 where id = ${id}`;
      } else {
        const [row] = await tx<{ id: string }[]>`
          insert into restix.events (college_id, slug, name, category, venue, description, starts_at, ends_at, status,
                                     transfer_policy, policy_source, policy_updated_at, created_by)
          values (${collegeId}, ${input.slug}, ${input.name}, ${input.category}, ${input.venue}, ${input.description},
                  ${input.startsAt}, ${input.endsAt}, ${input.status}, ${input.transferPolicy}, ${input.policySource},
                  ${input.policySource ? new Date() : null}, ${modId})
          returning id`;
        id = row.id;
      }
      // Ticket types: add new names, update face values; never delete one that listings use.
      for (const [i, t] of input.ticketTypes.entries()) {
        await tx`insert into restix.ticket_types (event_id, name, face_value_paise, sort_order)
                 values (${id!}, ${t.name}, ${t.faceValuePaise}, ${i})
                 on conflict (event_id, name) do update set face_value_paise = excluded.face_value_paise, sort_order = excluded.sort_order`;
      }
      const [{ count }] = await tx<{ count: number }[]>`select count(*)::int as count from restix.ticket_types where event_id = ${id!}`;
      if (count === 0) {
        await tx`insert into restix.ticket_types (event_id, name) values (${id!}, 'General')`;
      }
      // Listings for a newly prohibited event come down; for a newly unknown policy they go back to review.
      if (input.transferPolicy === "prohibited") {
        await tx`update restix.ticket_listings set status = 'removed', status_reason = 'The organisers do not allow resale for this event',
                   version = version + 1
                 where event_id = ${id!} and status in ('active', 'paused', 'pending_review')`;
      } else if (input.transferPolicy === "unknown") {
        await tx`update restix.ticket_listings set status = 'pending_review', version = version + 1
                 where event_id = ${id!} and status = 'active'`;
      } else if (input.transferPolicy === "face_value_only" && eventId && before.transferPolicy !== "face_value_only") {
        // Newly capped at face value. The database won't hold a listing above the cap, so those go back to the
        // seller as drafts to reprice; ones with no face value on record to check against go to a moderator.
        await tx`update restix.ticket_listings l set status = 'draft', published_at = null, version = version + 1,
                   status_reason = 'The organisers now cap resale at face value. Lower the price to list it again.'
                 where l.event_id = ${id!} and l.status in ('active', 'paused', 'pending_review')
                   and (l.original_price_paise is null or l.asking_price_paise > l.original_price_paise
                        or l.asking_price_paise > coalesce((select t.face_value_paise from restix.ticket_types t where t.id = l.ticket_type_id), 2147483647))`;
        await tx`update restix.ticket_listings l set status = 'pending_review', version = version + 1
                 where l.event_id = ${id!} and l.status = 'active'
                   and (select t.face_value_paise from restix.ticket_types t where t.id = l.ticket_type_id) is null`;
      }
      await tx`insert into restix.moderation_actions (actor_id, action, reason, event_id, metadata)
               values (${modId}, ${eventId ? "update_event" : "create_event"}, ${input.reason}, ${id!},
                       ${tx.json({ before, after: { status: input.status, transferPolicy: input.transferPolicy } } as never)})`;
      return { ok: true, id: id! };
    });
  } catch (err) {
    if (pgCode(err) === PG.uniqueViolation) return { ok: false, error: "Another event already uses that URL slug." };
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "You don't have permission to do that." };
    console.error("save event failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "The event wasn't saved because of a server error." };
  }
}

export async function eventForEdit(modId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asUser(modId, async (tx) => {
    const [e] = await tx<{
      id: string; name: string; slug: string; category: string; venue: string | null; description: string | null;
      startsAt: Date; endsAt: Date | null; status: string; transferPolicy: string; policySource: string | null; isFixture: boolean;
      coverVersion: number | null; listings: number;
    }[]>`select id, name, slug, category, venue, description, starts_at, ends_at, status, transfer_policy, policy_source, is_fixture,
           (select version from restix.event_covers c where c.event_id = e.id) as cover_version,
           (select count(*)::int from restix.ticket_listings l where l.event_id = e.id) as listings
         from restix.events e where e.id = ${id}`;
    if (!e) return null;
    const types = await tx<{ name: string; faceValuePaise: number | null }[]>`
      select name, face_value_paise from restix.ticket_types where event_id = ${id} order by sort_order, name`;
    return { ...e, ticketTypes: types };
  });
}

export async function allEvents(modId: string) {
  return asUser(modId, (tx) => tx<{
    id: string; name: string; slug: string; startsAt: Date; status: string; transferPolicy: string; isFixture: boolean;
    activeListings: number; pendingListings: number;
  }[]>`
    select e.id, e.name, e.slug, e.starts_at, e.status, e.transfer_policy, e.is_fixture,
           (select count(*)::int from restix.ticket_listings l where l.event_id = e.id and l.status = 'active' and l.expires_at > now()) as active_listings,
           (select count(*)::int from restix.ticket_listings l where l.event_id = e.id and l.status = 'pending_review') as pending_listings
    from restix.events e
    where e.college_id = restix.my_college_id()
    order by (coalesce(e.ends_at, e.starts_at) < now()), e.starts_at`);
}

// ---------------------------------------------------------------------------
// Event suggestions from students
// ---------------------------------------------------------------------------

export const suggestionInput = z.object({
  name: z.string().transform(cleanText).pipe(z.string().min(2, "Name the event.").max(120)),
  startsAt: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = fromLocalInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Pick the date and time." });
        return z.NEVER;
      }
      if (d.getTime() < Date.now() - 3600_000) {
        ctx.addIssue({ code: "custom", message: "That's already happened. Pick an upcoming date." });
        return z.NEVER;
      }
      return d;
    }),
  venue: z.string().transform(cleanText).pipe(z.string().max(120)).optional().transform((v) => v || null),
  category: z
    .string()
    .optional()
    .transform((v) => (v && v in EVENT_CATEGORIES ? (v as keyof typeof EVENT_CATEGORIES) : null)),
  details: z.string().transform(cleanText).pipe(z.string().max(1000)).optional().transform((v) => v || null),
});

export async function suggestEvent(viewerId: string, input: z.output<typeof suggestionInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await allow("report", `suggest:${viewerId}`))) return { ok: false, error: "You've suggested a lot of events today. Moderators will get to them." };
  try {
    await asUser(viewerId, (tx) => tx`
      insert into restix.event_suggestions (suggested_by, name, starts_at, happens_on, venue, category, details)
      values (${viewerId}, ${input.name}, ${input.startsAt}, ${input.startsAt ? istDate(input.startsAt) : null},
              ${input.venue}, ${input.category}, ${input.details})`);
    return { ok: true };
  } catch (err) {
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "Your account can't suggest events right now." };
    console.error("suggest event failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't send because of a server error. Try again." };
  }
}

export interface Suggestion {
  id: string;
  name: string;
  startsAt: Date | null;
  venue: string | null;
  category: string | null;
  happensOn: string | null;
  details: string | null;
  status: "open" | "added" | "declined";
  moderatorNote: string | null;
  suggestedByName: string | null;
  createdAt: Date;
}

export async function mySuggestions(viewerId: string): Promise<Suggestion[]> {
  return asUser(viewerId, (tx) => tx<Suggestion[]>`
    select s.id, s.name, s.starts_at, s.venue, s.category, to_char(s.happens_on, 'YYYY-MM-DD') as happens_on, s.details,
           s.status, s.moderator_note, null as suggested_by_name, s.created_at
    from restix.event_suggestions s where s.suggested_by = ${viewerId}
    order by s.created_at desc limit 10`);
}

export async function openSuggestions(modId: string): Promise<Suggestion[]> {
  return asUser(modId, (tx) => tx<Suggestion[]>`
    select s.id, s.name, s.starts_at, s.venue, s.category, to_char(s.happens_on, 'YYYY-MM-DD') as happens_on, s.details,
           s.status, s.moderator_note, p.display_name as suggested_by_name, s.created_at
    from restix.event_suggestions s left join restix.profiles p on p.id = s.suggested_by
    where s.status = 'open' and s.college_id = restix.my_college_id()
    order by s.created_at limit 50`);
}

export async function decideSuggestion(
  modId: string,
  input: { id: string; status: "added" | "declined"; note: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const rows = await asUser(modId, (tx) => tx`
      update restix.event_suggestions
      set status = ${input.status}, moderator_note = ${input.note}, decided_by = ${modId}, decided_at = now()
      where id = ${input.id} and status = 'open' returning id`);
    return rows.length ? { ok: true } : { ok: false, error: "This suggestion was already handled." };
  } catch (err) {
    console.error("decide suggestion failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error." };
  }
}

/** The calendar date in India for a moment, as YYYY-MM-DD. */
function istDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

export function slugFor(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "event";
  return `${base.length < 2 ? "event" : base}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Publishes a student's event request as it stands: the event goes live (resale allowed, no
 * restrictions) with a "General" ticket type, the request is marked added, and the moderation
 * log records who approved it. Returns the new event's slug.
 */
export async function approveSuggestion(modId: string, id: string, note: string | null): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    return await asUser(modId, async (tx) => {
      const [sg] = await tx<{ collegeId: string; name: string; startsAt: Date | null; happensOn: string | null; venue: string | null; category: string | null; details: string | null; status: string }[]>`
        select college_id, name, starts_at, to_char(happens_on, 'YYYY-MM-DD') as happens_on, venue, category, details, status
        from restix.event_suggestions where id = ${id} for update`;
      if (!sg) return { ok: false as const, error: "Request not found." };
      if (sg.status !== "open") return { ok: false as const, error: "This request was already handled." };
      // No time given: assume 7 pm in India on the day they named.
      const startsAt = sg.startsAt ?? (sg.happensOn ? fromLocalInput(`${sg.happensOn}T19:00`) : null);
      if (!startsAt) return { ok: false as const, error: "This request has no date. Use “Edit first” to add one." };
      if (startsAt.getTime() <= Date.now()) return { ok: false as const, error: "This event's date has passed. Decline it, or use “Edit first” to fix the date." };
      const slug = slugFor(sg.name);
      const [ev] = await tx<{ id: string }[]>`
        insert into restix.events (college_id, slug, name, category, venue, description, starts_at, status, transfer_policy, created_by)
        values (${sg.collegeId}, ${slug}, ${sg.name}, ${sg.category ?? "other"}, ${sg.venue}, ${sg.details}, ${startsAt},
                'scheduled', 'allowed', ${modId})
        returning id`;
      await tx`insert into restix.ticket_types (event_id, name) values (${ev.id}, 'General')`;
      await tx`update restix.event_suggestions
               set status = 'added', event_id = ${ev.id}, moderator_note = ${note}, decided_by = ${modId}, decided_at = now()
               where id = ${id}`;
      await tx`insert into restix.moderation_actions (actor_id, action, reason, event_id, metadata)
               values (${modId}, 'create_event', ${"Approved a student's event request"}, ${ev.id},
                       ${tx.json({ suggestionId: id } as never)})`;
      return { ok: true as const, slug };
    });
  } catch (err) {
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "You don't have permission to do that." };
    console.error("approve suggestion failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error." };
  }
}

/** Marks a request done once a moderator has published it through the full event editor. */
export async function linkSuggestion(modId: string, id: string, eventId: string): Promise<void> {
  await asUser(modId, (tx) => tx`
    update restix.event_suggestions set status = 'added', event_id = ${eventId}, decided_by = ${modId}, decided_at = now()
    where id = ${id} and status = 'open'`);
}

export async function suggestionById(modId: string, id: string): Promise<Suggestion | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await asUser(modId, (tx) => tx<Suggestion[]>`
    select s.id, s.name, s.starts_at, s.venue, s.category, to_char(s.happens_on, 'YYYY-MM-DD') as happens_on, s.details,
           s.status, s.moderator_note, null as suggested_by_name, s.created_at
    from restix.event_suggestions s where s.id = ${id}`);
  return row ?? null;
}
