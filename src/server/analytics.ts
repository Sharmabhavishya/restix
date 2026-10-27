import "server-only";
import { asSystem, type Tx } from "./db";

export const ANALYTICS_EVENTS = [
  "landing_viewed", "search_performed", "event_viewed", "listing_viewed",
  "listing_created", "listing_edited", "listing_published", "listing_closed",
  "inquiry_started", "inquiry_created", "inquiry_accepted",
  "outcome_confirmed", "report_submitted", "report_resolved",
  "email_verified", "signed_in",
  "offer_made", "offer_accepted", "listing_shared", "listing_saved",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** View-type events the browser may report through /api/track. Everything else is recorded server-side only. */
export const CLIENT_EVENTS = ["landing_viewed", "search_performed", "event_viewed", "listing_viewed", "inquiry_started"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export interface TrackContext {
  userId?: string | null;
  anonId?: string | null;
  listingId?: string | null;
  eventId?: string | null;
  /** Small, non-personal properties only (counts, enum values). Never free text, emails or names. */
  props?: Record<string, string | number | boolean | null>;
}

async function insert(tx: Tx, name: AnalyticsEvent, ctx: TrackContext) {
  await tx`insert into restix.analytics_events (name, user_id, anon_id, listing_id, event_id, props)
           values (${name}, ${ctx.userId ?? null}, ${ctx.userId ? null : ctx.anonId ?? null},
                   ${ctx.listingId ?? null}, ${ctx.eventId ?? null}, ${tx.json(ctx.props ?? {})})`;
}

/**
 * Records a first-party analytics event. Failures are logged and swallowed: analytics
 * must never break or fake the outcome of the user's actual action.
 */
export async function track(name: AnalyticsEvent, ctx: TrackContext = {}): Promise<void> {
  try {
    await asSystem((tx) => insert(tx, name, ctx));
  } catch (err) {
    console.error(`analytics: failed to record ${name}`, err instanceof Error ? err.message : err);
  }
}
