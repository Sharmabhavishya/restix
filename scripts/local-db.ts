// Local Postgres for development and tests: PGlite (real Postgres compiled to WASM)
// served over the Postgres wire protocol, so the app talks to it through the same
// `postgres` driver it uses against Supabase in production.
//
//   npm run db          persistent database in .data/pglite on LOCAL_DB_PORT (default 54329)
//   npm run db:reset    wipe .data/pglite first
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { migrate } from "./migrate";
import { seed } from "./seed";

const SHIM = path.join(process.cwd(), "db", "local", "supabase_shim.sql");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function startLocalDb(opts: { dataDir?: string; port?: number; seed?: boolean; quiet?: boolean }) {
  const log = opts.quiet ? () => {} : console.log;
  const db = await PGlite.create(opts.dataDir);
  await db.exec(await readFile(SHIM, "utf8"));
  const port = opts.port ?? (await freePort());
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  await migrate(url, log);
  if (opts.seed) await seed(url, log);
  return {
    url,
    port,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

if (process.argv[1]?.endsWith("local-db.ts")) {
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  const reset = process.argv.includes("--reset");
  (async () => {
    if (reset) await rm(dataDir, { recursive: true, force: true });
    await mkdir(path.dirname(dataDir), { recursive: true });
    const port = Number(process.env.LOCAL_DB_PORT ?? 54329);
    const { url, stop } = await startLocalDb({ dataDir, port, seed: true });
    console.log(`\nLocal database ready: ${url}\nPress Ctrl+C to stop.`);
    const shutdown = async () => {
      await stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
