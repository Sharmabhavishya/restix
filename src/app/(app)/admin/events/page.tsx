import type { Metadata } from "next";
import Link from "next/link";
import { requireModerator } from "@/server/auth/viewer";
import { allEvents } from "@/server/event-admin";
import { formatDateTime } from "@/lib/format";
import type { TransferPolicy } from "@/lib/listing-rules";
import { FixtureTag, PolicyPill } from "@/components/listing-bits";
import { EmptyState, Notice, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Manage events" };

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const events = await allEvents(mod.id);
  const unknown = events.filter((e) => e.transferPolicy === "unknown" && e.status !== "cancelled").length;
  return (
    <>
      <PageTitle
        title="Events"
        sub={unknown ? `${unknown} ${unknown === 1 ? "event has" : "events have"} no confirmed resale policy, so every listing needs a manual check.` : "Every event's resale rules are confirmed."}
        actions={<ButtonLink href="/admin/events/new">Add event</ButtonLink>}
      />
      {typeof sp.saved === "string" && <Notice tone="success" className="mb-5">Saved “{sp.saved}”.</Notice>}
      {events.length === 0 ? (
        <EmptyState title="no events yet" action={<ButtonLink href="/admin/events/new">Add the first one</ButtonLink>} />
      ) : (
        <Panel>
          <ul className="divide-y divide-rule">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-raised sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{e.name}</span>
                      {e.isFixture && <FixtureTag />}
                    </p>
                    <p className="text-[13px] text-muted">{formatDateTime(e.startsAt)} · {e.activeListings} live · {e.pendingListings} waiting for review</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status !== "scheduled" && <Pill tone={e.status === "cancelled" ? "negative" : "warning"}>{e.status}</Pill>}
                    <PolicyPill policy={e.transferPolicy as TransferPolicy} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
