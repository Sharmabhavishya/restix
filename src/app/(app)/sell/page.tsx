import type { Metadata } from "next";
import Link from "next/link";
import { requireBrowser, writeBlockReason } from "@/server/auth/viewer";
import { listableEvents } from "@/server/events";
import { eventCloseTime } from "@/lib/listing-rules";
import { ListingForm, type FormEvent } from "../listings/listing-form";
import { EmptyState, Notice, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Sell a ticket" };

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const sp = await searchParams;
  const viewer = await requireBrowser("/sell");
  const blocked = writeBlockReason(viewer);
  const events = await listableEvents(viewer.id);
  const formEvents: FormEvent[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    startsAt: e.startsAt.toISOString(),
    closesAt: eventCloseTime(e).toISOString(),
    status: e.status,
    transferPolicy: e.transferPolicy,
    policySource: e.policySource,
    isFixture: e.isFixture,
    ticketTypes: e.ticketTypes,
  }));
  const preselect = typeof sp.event === "string" ? events.find((e) => e.slug === sp.event)?.id : undefined;

  return (
    <>
      <PageTitle title="Sell a ticket" sub="takes about a minute. you'll share contact details only with buyers you say yes to." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="p-5 sm:p-7">
          {blocked ? (
            <Notice tone="warning" title="You can't list right now">{blocked}</Notice>
          ) : events.length === 0 ? (
            <EmptyState title="no upcoming events to list for">
              Moderators add events as they&apos;re announced. If yours is missing, <Link href="/events#suggest" className="underline">suggest it</Link> and they&apos;ll check the resale rules.
            </EmptyState>
          ) : (
            <ListingForm events={formEvents} defaults={{ eventId: preselect }} />
          )}
        </Panel>
        <aside className="flex flex-col gap-4 text-sm">
          <Panel className="p-5">
            <h2 className="font-semibold">Before you list</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-muted">
              <li>Only list a ticket you actually have, and only for events that allow resale.</li>
              <li>Never post a photo of a QR code, booking ID or receipt. Anyone who sees it could use it.</li>
              <li>Hand wristbands over in person, somewhere public on campus.</li>
              <li>Get paid at the handover, not before. ResTix can&apos;t recover money sent privately.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
