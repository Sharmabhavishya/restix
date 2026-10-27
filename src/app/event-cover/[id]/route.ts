import { getViewer } from "@/server/auth/viewer";
import { coverImage } from "@/server/event-covers";

// Serves an event's cover to signed-in students of the same college (RLS decides). The URL
// carries the cover's version, so a browser may keep it forever; a new cover is a new URL.
export async function GET(_req: Request, ctx: RouteContext<"/event-cover/[id]">) {
  const { id } = await ctx.params;
  const viewer = await getViewer().catch(() => null);
  if (!viewer || (viewer.access !== "ok" && viewer.access !== "restricted")) return new Response(null, { status: 404 });
  const cover = await coverImage(viewer.id, id);
  if (!cover) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(cover.image), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
