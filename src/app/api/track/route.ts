import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CLIENT_EVENTS, track } from "@/server/analytics";
import { getViewer } from "@/server/auth/viewer";
import { allow } from "@/server/rate-limit";
import { env } from "@/server/env";

// Page-view style events reported by the browser. The account comes from the session,
// never from the body; only a fixed set of events is accepted, and the only properties kept
// are two small numbers on searches. These counts are approximate by nature; outcome
// metrics use server-recorded events.
const body = z.object({
  name: z.enum(CLIENT_EVENTS),
  listingId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

const searchProps = z.object({
  filters: z.number().int().min(0).max(10),
  results: z.number().int().min(0).max(100_000),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(env().APP_URL).origin || origin === request.nextUrl.origin;
  // No Origin header: only accept what the browser itself marks as same-origin (curl sends neither).
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const viewer = await getViewer();
  const userId = viewer && viewer.access !== "no_profile" ? viewer.id : null;
  const aid = (await cookies()).get("restix_aid")?.value;
  const anonId = !userId && aid && UUID.test(aid) ? aid : null;
  // Signed-out visitors without an id (opted out via GPC/DNT) are not tracked at all.
  if (!userId && !anonId) return new NextResponse(null, { status: 204 });
  // Anonymous visitors only ever produce landing page views.
  if (!userId && parsed.data.name !== "landing_viewed") return new NextResponse(null, { status: 204 });

  // Anonymous ids are client-held, so anonymous traffic is also limited per network address.
  // x-real-ip is set by the platform (Vercel); a client-supplied x-forwarded-for is only a fallback.
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allow("track", userId ?? `ip:${ip}`)) || (anonId && !(await allow("track", anonId)))) {
    return new NextResponse(null, { status: 429 });
  }

  const props = parsed.data.name === "search_performed" ? searchProps.safeParse(parsed.data.props) : null;
  await track(parsed.data.name, {
    userId,
    anonId,
    listingId: userId ? parsed.data.listingId ?? null : null,
    eventId: userId ? parsed.data.eventId ?? null : null,
    props: props?.success ? props.data : undefined,
  });
  return new NextResponse(null, { status: 204 });
}
