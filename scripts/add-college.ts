// Registers a college and the email domain(s) that belong to it. A domain must ALSO be
// listed in ALLOWED_EMAIL_DOMAINS before anyone from it can sign in.
//
//   DATABASE_URL=... npm run college:add -- --slug snu --name "Shiv Nadar University" --short SNU --domain snu.edu.in
import postgres from "postgres";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  const slug = arg("slug");
  const name = arg("name");
  const short = arg("short");
  const domains = process.argv.flatMap((a, i) => (a === "--domain" ? [process.argv[i + 1]?.toLowerCase()] : [])).filter(Boolean) as string[];
  if (!url || !slug || !name || !short || domains.length === 0) {
    console.error('usage: DATABASE_URL=... npm run college:add -- --slug snu --name "Full Name" --short SNU --domain snu.edu.in [--domain other.edu.in]');
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const [c] = await tx<{ id: string }[]>`
        insert into restix.colleges (slug, name, short_name) values (${slug}, ${name}, ${short})
        on conflict (slug) do update set name = excluded.name, short_name = excluded.short_name
        returning id`;
      for (const d of domains) {
        await tx`insert into restix.college_email_domains (domain, college_id) values (${d}, ${c.id})
                 on conflict (domain) do update set college_id = excluded.college_id`;
      }
    });
    console.log(`College ${name} (${slug}) has domains: ${domains.join(", ")}`);
    console.log("Remember: each domain must also be in ALLOWED_EMAIL_DOMAINS.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
