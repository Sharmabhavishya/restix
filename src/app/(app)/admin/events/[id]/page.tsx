import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModerator } from "@/server/auth/viewer";
import { eventForEdit } from "@/server/event-admin";
import { coverUrl } from "@/server/event-covers";
import { toLocalInput } from "@/lib/format";
import { paiseToInput } from "@/lib/money";
import { EventForm } from "../event-form";
import { DeleteEvent } from "../delete-event";
import { Notice, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const mod = await requireModerator();
  const e = await eventForEdit(mod.id, id);
  if (!e) notFound();
  return (
    <>
      <PageTitle title={e.name} sub="Changes go live straight away, including for listings already up." />
      {e.isFixture && <Notice tone="warning" className="mb-5">This is a development sample event. It is labelled as sample data everywhere.</Notice>}
      <Panel className="max-w-3xl p-5 sm:p-7">
        <EventForm
          d={{
            eventId: e.id,
            name: e.name,
            slug: e.slug,
            category: e.category,
            venue: e.venue,
            description: e.description,
            startsAt: toLocalInput(e.startsAt),
            endsAt: toLocalInput(e.endsAt),
            status: e.status,
            transferPolicy: e.transferPolicy,
            policySource: e.policySource,
            ticketFormat: e.ticketFormat,
            ticketTypes: e.ticketTypes.map((t) => (t.faceValuePaise !== null ? `${t.name}, ${paiseToInput(t.faceValuePaise)}` : t.name)).join("\n"),
            coverUrl: e.coverVersion ? coverUrl(e.id, e.coverVersion) : null,
          }}
        />
      </Panel>
      {mod.role === "admin" && <DeleteEvent eventId={e.id} name={e.name} listings={e.listings} />}
    </>
  );
}
