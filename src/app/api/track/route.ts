import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CLIENT_EVENTS, track } from "@/server/analytics";
import { getViewer } from "@/server/auth/viewer";
import { allow } from "@/server/rate-limit";
import { env } from "@/server/env";

// Page-view style events reported by the browser. The account comes from the session,
// never from the body, and only a fixed set of events and small, non-personal properties
// are accepted. These counts are approximate by nature; outcome metrics use server-recorded events.
const body = z.object({
  name: z.enum(CLIENT_EVENTS),
  listingId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  props: z.record(z.string().max(32), z.union([z.number().finite(), z.boolean(), z.string().max(32)])).optional()
    .refine((p) => !p || Object.keys(p).length <= 8, "too many props"),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  // Same-origin only: a cross-site page should not be able to inflate counts.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env().APP_URL).origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
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
  if (!(await allow("track", userId ?? anonId!))) return new NextResponse(null, { status: 429 });

  await track(parsed.data.name, {
    userId,
    anonId,
    listingId: parsed.data.listingId ?? null,
    eventId: parsed.data.eventId ?? null,
    props: parsed.data.props,
  });
  return new NextResponse(null, { status: 204 });
}
