import type { Metadata } from "next";
import { requireModerator } from "@/server/auth/viewer";
import { EventForm } from "../event-form";
import { PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Add event" };

export default async function NewEventPage() {
  await requireModerator();
  return (
    <>
      <PageTitle title="Add an event" sub="Only add real, announced events. Set the resale policy only when someone with authority has confirmed it." />
      <Panel className="max-w-3xl p-5 sm:p-7">
        <EventForm />
      </Panel>
    </>
  );
}
