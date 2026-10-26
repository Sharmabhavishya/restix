import "server-only";
import { asSystem } from "./db";

// Fixed-window limits backed by Postgres, so they hold across serverless instances.
export const LIMITS = {
  createListing: { limit: 10, windowSeconds: 24 * 3600 },
  editListing: { limit: 60, windowSeconds: 3600 },
  inquiry: { limit: 15, windowSeconds: 24 * 3600 },
  inquiryBurst: { limit: 4, windowSeconds: 10 * 60 },
  report: { limit: 8, windowSeconds: 24 * 3600 },
  respond: { limit: 60, windowSeconds: 3600 },
  track: { limit: 120, windowSeconds: 3600 },
  devSignIn: { limit: 30, windowSeconds: 600 },
  profile: { limit: 20, windowSeconds: 3600 },
  moderation: { limit: 300, windowSeconds: 3600 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Counts one attempt for `subject` and returns false once it exceeds the limit. */
export async function allow(name: LimitName, subject: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[name];
  const [row] = await asSystem((tx) => tx<{ ok: boolean }[]>`
    select restix.hit_rate_limit(${`${name}:${subject}`}, ${limit}, ${windowSeconds}) as ok`);
  return row.ok;
}
