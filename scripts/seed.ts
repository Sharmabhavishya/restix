// Development fixtures for the LOCAL database only (scripts/local-db.ts calls this).
// Every event is flagged is_fixture so the UI labels it as sample data, and no
// analytics rows are seeded: dashboards only ever show recorded activity.
import postgres from "postgres";

import { DEV_COLLEGE, DEV_USERS } from "../src/server/dev-fixtures";
export { DEV_COLLEGE, DEV_USERS };

const DAY = 24 * 60 * 60 * 1000;

export async function seed(databaseUrl: string, log: (msg: string) => void = console.log) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from restix.colleges`;
    if (count > 0) {
      log("seed: database already has data, skipping");
      return;
    }
    await sql.begin(async (tx) => {
      const [college] = await tx<{ id: string }[]>`
        insert into restix.colleges (slug, name, short_name)
        values (${DEV_COLLEGE.slug}, ${DEV_COLLEGE.name}, ${DEV_COLLEGE.shortName}) returning id`;
      await tx`insert into restix.college_email_domains (domain, college_id) values (${DEV_COLLEGE.domain}, ${college.id})`;

      for (const u of DEV_USERS) {
        await tx`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
                 values (${u.id}, ${u.email}, now(), ${tx.json({ full_name: u.name })})`;
        await tx`insert into restix.profiles (id, college_id, display_name, email_verified_at, onboarded_at)
                 values (${u.id}, ${college.id}, ${u.name}, now(), now())`;
        await tx`insert into restix.profile_private (user_id, email) values (${u.id}, ${u.email})`;
        if (u.role) await tx`insert into restix.admin_roles (user_id, role) values (${u.id}, ${u.role})`;
      }

      const now = Date.now();
      const events = [
        { slug: "spring-fest-night-2", name: "Spring Fest: Night 2", category: "fest", days: 9, policy: "allowed",
          source: "Sample policy for development", venue: "Main Ground",
          types: [["Night pass", 80000], ["Night pass + pit", 140000]] },
        { slug: "freshers-party", name: "Freshers' Party", category: "party", days: 4, policy: "face_value_only",
          source: "Sample policy: resale at or below face value", venue: "Student Activity Centre",
          types: [["Entry wristband", 50000]] },
        { slug: "senior-prom", name: "Senior Prom", category: "prom", days: 21, policy: "unknown",
          source: null, venue: "Convention Hall", types: [["Single", 120000], ["Couple", 200000]] },
        { slug: "indie-night", name: "Indie Night: Campus Bands", category: "concert", days: 14, policy: "allowed",
          source: "Sample policy for development", venue: "Amphitheatre", types: [["General", 30000]] },
        { slug: "design-workshop", name: "Interface Design Workshop", category: "workshop", days: 6,
          policy: "prohibited", source: "Sample policy: registrations are personal and non-transferable",
          venue: "Academic Block B", types: [["Seat", 20000]] },
        { slug: "hostel-football-final", name: "Inter-hostel Football Final", category: "sports", days: 3,
          policy: "allowed", source: "Sample policy for development", venue: "Sports Complex",
          types: [["Stand", 10000]], status: "cancelled" },
      ] as const;

      const ids: Record<string, { id: string; types: string[] }> = {};
      for (const e of events) {
        const starts = new Date(now + e.days * DAY + 19 * 60 * 60 * 1000);
        const [row] = await tx<{ id: string }[]>`
          insert into restix.events (college_id, slug, name, category, venue, starts_at, ends_at, status,
                                     transfer_policy, policy_source, policy_updated_at, is_fixture, description)
          values (${college.id}, ${e.slug}, ${e.name}, ${e.category}, ${e.venue}, ${starts},
                  ${new Date(starts.getTime() + 5 * 60 * 60 * 1000)}, ${"status" in e ? e.status : "scheduled"},
                  ${e.policy}, ${e.source}, ${e.source ? new Date() : null}, true,
                  ${"Sample event created for local development. It is not a real event."})
          returning id`;
        const typeIds: string[] = [];
        let order = 0;
        for (const [name, face] of e.types) {
          const [t] = await tx<{ id: string }[]>`
            insert into restix.ticket_types (event_id, name, face_value_paise, sort_order)
            values (${row.id}, ${name}, ${face}, ${order++}) returning id`;
          typeIds.push(t.id);
        }
        ids[e.slug] = { id: row.id, types: typeIds };
      }

      const [asha] = DEV_USERS;
      const listings = [
        { event: "spring-fest-night-2", type: 0, format: "wristband", qty: 2, ask: 90000, orig: 80000, area: "Library steps" },
        { event: "spring-fest-night-2", type: 1, format: "wristband", qty: 1, ask: 150000, orig: 140000, area: "Hostel gate 2" },
        { event: "freshers-party", type: 0, format: "wristband", qty: 1, ask: 45000, orig: 50000, area: "Food court" },
        { event: "indie-night", type: 0, format: "digital", qty: 3, ask: 25000, orig: 30000, area: null },
      ] as const;
      for (const l of listings) {
        const ev = ids[l.event];
        await tx`
          insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
            original_price_paise, handover_method, meetup_area, seller_notes, status, expires_at, published_at)
          values (${ev.id}, ${ev.types[l.type]}, ${asha.id}, ${l.format}, ${l.qty}, ${l.ask}, ${l.orig},
            ${l.format === "digital" ? "digital_transfer" : "in_person"}, ${l.area},
            ${"Sample listing for local development."}, 'active',
            ${new Date(now + 3 * DAY)}, now())`;
      }
    });
    log("seed: development fixtures inserted");
  } finally {
    await sql.end();
  }
}
