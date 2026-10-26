// Applies supabase/migrations/*.sql in filename order, once each, recording them in
// restix_meta.migrations. Works against any Postgres reachable through DATABASE_URL:
// the local PGlite server, a test database, or a Supabase project.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export async function migrate(databaseUrl: string, log: (msg: string) => void = console.log) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql`create schema if not exists restix_meta`;
    await sql`create table if not exists restix_meta.migrations (
      name text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql<{ name: string }[]>`select name from restix_meta.migrations`).map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into restix_meta.migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  migrate(url).then(
    () => console.log("migrations up to date"),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
