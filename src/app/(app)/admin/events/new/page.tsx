import type { Metadata } from "next";
import { requireModerator } from "@/server/auth/viewer";
import { suggestionById, slugFor } from "@/server/event-admin";
import { toLocalInput } from "@/lib/format";
import { EventForm, type EventDefaults } from "../event-form";
import { Notice, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Add event" };

export default async function NewEventPage({ searchParams }: PageProps<"/admin/events/new">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  // "Edit first" on a student's request: start from what they sent.
  const request = typeof sp.request === "string" ? await suggestionById(mod.id, sp.request) : null;
  const d: EventDefaults = request && request.status === "open"
    ? {
        requestId: request.id,
        name: request.name,
        slug: slugFor(request.name),
        category: request.category ?? "other",
        venue: request.venue,
        description: request.details,
        startsAt: request.startsAt ? toLocalInput(request.startsAt) : request.happensOn ? `${request.happensOn}T19:00` : "",
        ticketFormat: request.ticketFormat,
        // The levels the student named, one per line (the editor's format); none means one kind.
        ticketTypes: request.ticketTypes.join("\n"),
      }
    : {};
  return (
    <>
      <PageTitle title="Add an event" sub="It goes live for students as soon as you save it. Resale is open at any price unless you add a restriction." />
      {request && request.status !== "open" && <Notice tone="info" className="mb-5">That request was already handled.</Notice>}
      <Panel className="max-w-3xl p-5 sm:p-7">
        <EventForm d={d} />
      </Panel>
    </>
  );
}
