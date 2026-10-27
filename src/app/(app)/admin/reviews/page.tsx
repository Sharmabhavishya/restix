import type { Metadata } from "next";
import Link from "next/link";
import { requireModerator } from "@/server/auth/viewer";
import { pendingListings } from "@/server/moderation";
import { FORMAT_LABEL, POLICY_LABEL, type TicketFormat, type TransferPolicy } from "@/lib/listing-rules";
import { formatPaise } from "@/lib/money";
import { relativeTime } from "@/lib/format";
import { ModForm } from "../mod-form";
import { EmptyState, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Listing checks" };

export default async function ReviewsPage() {
  const mod = await requireModerator();
  const rows = await pendingListings(mod.id);
  return (
    <>
      <PageTitle
        title="Listing checks"
        sub="Listings for events whose resale rules aren't confirmed. Approve only if you know resale is allowed; better still, confirm the event's policy so future listings go live on their own."
      />
      {rows.length === 0 ? (
        <EmptyState title="nothing waiting">Listings for events with an unconfirmed policy show up here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((l) => (
            <li key={l.id}>
              <Panel className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link href={`/listings/${l.id}`} className="hover:underline">{l.eventName}</Link>
                  </p>
                  <p className="text-[13px] text-muted">
                    {l.ticketTypeName} · {FORMAT_LABEL[l.format as TicketFormat]} · ×{l.quantity} · {formatPaise(l.askingPricePaise)}
                    {l.originalPricePaise !== null ? ` (paid ${formatPaise(l.originalPricePaise)})` : ""} · by {l.sellerName} · {relativeTime(l.createdAt)}
                  </p>
                  <p className="mt-2 text-[13px]">
                    Event policy: <span className="font-medium">{POLICY_LABEL[l.transferPolicy as TransferPolicy]}</span>.{" "}
                    <Link href={`/admin/events/${l.eventId}`} className="underline">Set the policy</Link>
                  </p>
                  {l.sellerNotes && <p className="mt-2 text-sm whitespace-pre-line text-muted">{l.sellerNotes}</p>}
                </div>
                <ModForm
                  hidden={{ listingId: l.id, version: String(l.version) }}
                  compact
                  placeholder="e.g. Organisers confirmed transfers are fine"
                  ops={[
                    { op: "listing:approve", label: "Approve", tone: "primary" },
                    { op: "listing:reject", label: "Reject", tone: "danger" },
                  ]}
                />
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
