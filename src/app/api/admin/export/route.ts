import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/viewer";
import { exportAccounts } from "@/server/admin";
import { allow } from "@/server/rate-limit";
import { phoneCell, toCsv } from "@/lib/csv";
import { TIME_ZONE } from "@/lib/format";

// Admins download every account as a spreadsheet. The role is checked again in the database
// transaction, and each download is written to the audit log.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.access !== "ok" || viewer.role !== "admin") return new NextResponse("Admins only.", { status: 403 });
  if (!(await allow("moderation", viewer.id))) return new NextResponse("Too many requests. Try again in a bit.", { status: 429 });
  const rows = await exportAccounts(viewer.id);
  if (!rows) return new NextResponse("Admins only.", { status: 403 });

  const day = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) : "");
  const csv = toCsv(
    ["Name", "Email", "WhatsApp", "Status", "Role", "Joined", "Listings", "Requests sent"],
    rows.map((r) => [r.displayName, r.email, phoneCell(r.whatsappNumber), r.status, r.role ?? "student", day(r.createdAt), r.listings, r.requests]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="restix-accounts-${day(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
