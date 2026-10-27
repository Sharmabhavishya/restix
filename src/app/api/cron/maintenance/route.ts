import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { asSystem } from "@/server/db";

// Daily housekeeping: expire listings, purge analytics older than 18 months and old
// rate-limit rows. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || secret.length < 16 || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse(null, { status: 401 });
  }
  try {
    const [row] = await asSystem((tx) => tx<{ result: Record<string, number> }[]>`select restix.purge_old_data() as result`);
    return NextResponse.json({ ok: true, ...row.result });
  } catch (err) {
    console.error("maintenance failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
