import type { Metadata } from "next";
import Link from "next/link";
import { requireModerator } from "@/server/auth/viewer";
import { recentAudit } from "@/server/moderation";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const mod = await requireModerator();
  const rows = await recentAudit(mod.id, 200);
  return (
    <>
      <PageTitle title="Audit log" sub="Every moderation action, newest first. Entries can't be edited or deleted, by anyone." />
      {rows.length === 0 ? (
        <EmptyState title="no actions yet" />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="px-5 py-3 font-normal">When</th>
                <th className="px-3 py-3 font-normal">Who</th>
                <th className="px-3 py-3 font-normal">Action</th>
                <th className="hidden px-5 py-3 font-normal md:table-cell">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="num px-5 py-3 whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.actorName ?? "deleted account"}</td>
                  <td className="px-3 py-3">
                    <span className="font-medium">{r.action.replace(/_/g, " ")}</span>
                    {r.reportId && (
                      <> · <Link href={`/admin/reports/${r.reportId}`} className="underline">report</Link></>
                    )}
                    {r.listingId && (
                      <> · <Link href={`/listings/${r.listingId}`} className="underline">listing</Link></>
                    )}
                    <p className="mt-1 text-muted md:hidden">{r.reason}</p>
                  </td>
                  <td className="hidden px-5 py-3 text-muted md:table-cell">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
