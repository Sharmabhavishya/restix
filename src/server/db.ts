import "server-only";
import postgres from "postgres";
import { env } from "./env";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { restixSql?: Sql };

function client(): Sql {
  if (!globalForDb.restixSql) {
    globalForDb.restixSql = postgres(env().DATABASE_URL, {
      max: env().DB_POOL_MAX,
      // Required for Supabase's transaction-mode pooler; harmless elsewhere.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      // Result columns arrive as camelCase (asking_price_paise -> askingPricePaise).
      transform: { column: { from: postgres.toCamel } },
    });
  }
  return globalForDb.restixSql;
}

/**
 * Runs `fn` in a transaction as the given user: role `authenticated` with the user's id
 * in request.jwt.claims, exactly as Supabase does, so row-level security applies.
 * Use this for everything a signed-in user does.
 */
export function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  }) as Promise<T>;
}

/**
 * Runs `fn` with the server's own privileges (RLS bypassed). Reserved for work no
 * user can be trusted with: creating profiles after sign-in, recording analytics,
 * rate limiting, expiring listings and rendering public pages from vetted columns.
 */
export function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(fn) as Promise<T>;
}

/** Postgres error codes the app turns into user-facing messages. */
export const PG = {
  uniqueViolation: "23505",
  checkViolation: "23514",
  foreignKeyViolation: "23503",
  insufficientPrivilege: "42501",
  serializationFailure: "40001",
  rlsViolation: "42501",
} as const;

export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
