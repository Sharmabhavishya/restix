import { randomUUID } from "node:crypto";
import { inject } from "vitest";

// Configure the app's env before any server module reads it.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.ALLOWED_EMAIL_DOMAINS = "snu.edu.in";
process.env.AUTH_MODE = "dev";
process.env.DEV_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
process.env.DB_POOL_MAX = "4";
process.env.TEST_EMAILS = "tester.one@gmail.com";
process.env.DEFAULT_COLLEGE_SLUG = "test-college";

export const db = await import("@/server/db");

let collegeId: string | undefined;

export async function college(): Promise<string> {
  if (collegeId) return collegeId;
  collegeId = await db.asSystem(async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from restix.colleges where slug = 'test-college'`;
    if (existing) return existing.id;
    const [c] = await tx<{ id: string }[]>`
      insert into restix.colleges (slug, name, short_name) values ('test-college', 'Test College', 'TC') returning id`;
    await tx`insert into restix.college_email_domains (domain, college_id) values ('snu.edu.in', ${c.id})
             on conflict do nothing`;
    return c.id;
  });
  return collegeId;
}

export async function makeUser(opts: { verified?: boolean; role?: "moderator" | "admin"; status?: string; collegeId?: string } = {}) {
  const id = randomUUID();
  const email = `user-${id.slice(0, 8)}@snu.edu.in`;
  const cid = opts.collegeId ?? (await college());
  await db.asSystem(async (tx) => {
    await tx`insert into auth.users (id, email, email_confirmed_at) values (${id}, ${email}, now())`;
    await tx`insert into restix.profiles (id, college_id, display_name, email_verified_at, status)
             values (${id}, ${cid}, ${"User " + id.slice(0, 4)}, ${opts.verified === false ? null : new Date()},
                     ${opts.status ?? "active"})`;
    await tx`insert into restix.profile_private (user_id, email) values (${id}, ${email})`;
    if (opts.role) await tx`insert into restix.admin_roles (user_id, role) values (${id}, ${opts.role})`;
  });
  return { id, email };
}

export async function makeEvent(over: { policy?: string; status?: string; collegeId?: string } = {}) {
  const cid = over.collegeId ?? (await college());
  return db.asSystem(async (tx) => {
    const [e] = await tx<{ id: string }[]>`
      insert into restix.events (college_id, slug, name, category, starts_at, status, transfer_policy)
      values (${cid}, ${"ev-" + randomUUID().slice(0, 8)}, 'Test Event', 'fest', now() + interval '10 days',
              ${over.status ?? "scheduled"}, ${over.policy ?? "allowed"})
      returning id`;
    const [t] = await tx<{ id: string }[]>`
      insert into restix.ticket_types (event_id, name, face_value_paise) values (${e.id}, 'General', 50000) returning id`;
    return { eventId: e.id, ticketTypeId: t.id };
  });
}

export async function makeListing(sellerId: string, over: { status?: string; eventId?: string; ticketTypeId?: string; negotiable?: boolean } = {}) {
  const ev = over.eventId ? { eventId: over.eventId, ticketTypeId: over.ticketTypeId! } : await makeEvent();
  return db.asSystem(async (tx) => {
    const [l] = await tx<{ id: string }[]>`
      insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
        handover_method, status, expires_at, price_negotiable)
      values (${ev.eventId}, ${ev.ticketTypeId}, ${sellerId}, 'wristband', 1, 50000, 'in_person',
              ${over.status ?? "active"}, now() + interval '5 days', ${over.negotiable ?? false})
      returning id`;
    return { listingId: l.id, ...ev };
  });
}

/** Resolves to the Postgres error code the operation failed with, or "ok". */
export async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (err) {
    return db.pgCode(err) ?? `non-pg: ${String(err)}`;
  }
}
