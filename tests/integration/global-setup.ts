import type { TestProject } from "vitest/node";
import { startLocalDb } from "../../scripts/local-db";

// One in-memory PGlite database for the whole integration run, migrated from the real
// supabase/migrations files on top of the local Supabase shim.
export default async function setup(project: TestProject) {
  const db = await startLocalDb({ quiet: true });
  project.provide("databaseUrl", db.url);
  return async () => {
    await db.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
