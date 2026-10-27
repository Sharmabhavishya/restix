import type { Metadata } from "next";
import { requireBrowser, writeBlockReason } from "@/server/auth/viewer";
import { listableEvents } from "@/server/events";
import { eventCloseTime } from "@/lib/listing-rules";
import { ListingForm, type FormEvent } from "../listings/listing-form";
import { EmptyState, Notice, PageTitle, Panel } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { SuggestForm } from "../events/suggest-form";

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
    wants: e.wantCount ?? 0,
  }));
  const preselect = typeof sp.event === "string" ? events.find((e) => e.slug === sp.event)?.id : undefined;

  return (
    <>
      <PageTitle title="Sell a ticket" sub="takes about a minute. no group-chat spam: your number stays private until you say yes to a buyer." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="p-5 sm:p-7">
          {blocked ? (
            <Notice tone="warning" title="You can't list right now">{blocked}</Notice>
          ) : events.length === 0 ? (
            <EmptyState title="no events up yet">
              Add yours below. Once an admin approves it, you can list your ticket.
            </EmptyState>
          ) : (
            <ListingForm events={formEvents} defaults={{ eventId: preselect }} />
          )}
        </Panel>
        {!blocked && (
          <Panel className="p-5 sm:p-7 lg:col-start-1">
            <details id="add-event" className="group" open={events.length === 0 || sp.add === "1" || undefined}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-display text-lg font-bold">Can&apos;t find your event?</span>
                  <span className="block text-[14px] text-muted">Add it. It goes live for everyone once an admin approves it.</span>
                </span>
                <span aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-5 border-t border-border pt-5">
                {viewer.role ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-muted">You&apos;re an admin, so you can put it up straight away.</p>
                    <ButtonLink href="/admin/events/new" variant="dark">Add it now</ButtonLink>
                  </div>
                ) : (
                  <SuggestForm />
                )}
              </div>
            </details>
          </Panel>
        )}
        <aside className="flex flex-col gap-4 text-sm lg:col-start-2 lg:row-start-1">
          <Panel className="p-5">
            <h2 className="font-semibold">Before you list</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-muted">
              <li className="font-medium text-ink">Your number stays private. A buyer only gets your WhatsApp after you accept them.</li>
              <li>Only list a ticket you actually have.</li>
              <li>Never post a photo of a QR code, booking ID or receipt. Anyone who sees it could use it.</li>
              <li>Hand physical tickets over in person, somewhere public.</li>
              <li>Get paid at the handover, not before. ResTix can&apos;t recover money sent privately.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
