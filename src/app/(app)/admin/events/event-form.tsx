"use client";

import { useActionState, useEffect, useState } from "react";
import { initialState } from "@/lib/action-state";
import { checkSlugAction, saveEventAction } from "../actions";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { DateTimeQuick, KindPicker, VenueChips } from "@/components/event-fields";
import { useFormFeedback } from "@/lib/use-form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { CoverPicker } from "./cover-picker";
import { TicketTypesEditor } from "./ticket-types-editor";
import { FormatChoice } from "@/components/format-choice";
import type { TicketFormat } from "@/lib/listing-rules";

export interface EventDefaults {
  eventId?: string;
  name?: string;
  slug?: string;
  category?: string;
  venue?: string | null;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  transferPolicy?: string;
  policySource?: string | null;
  ticketTypes?: string;
  /** The kind of ticket the whole event uses; null leaves it to each seller. */
  ticketFormat?: TicketFormat | null;
  /** The student request this event comes from, marked done when it's saved. */
  requestId?: string;
  /** Where the current cover is served from, when there is one. */
  coverUrl?: string | null;
}

const POLICIES = [
  ["allowed", "None: resale at any price (default)"],
  ["face_value_only", "Price cap: face value or less"],
  ["prohibited", "No resale (hides the event, removes live listings)"],
  ["unknown", "Hold: hide the event until rules are confirmed"],
] as const;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function EventForm({ d = {} }: { d?: EventDefaults }) {
  const [state, action] = useActionState(saveEventAction, initialState);
  const v = state.values;
  const fe = state.fieldErrors ?? {};
  const [name, setName] = useState(v?.name ?? d.name ?? "");
  const [slug, setSlug] = useState(v?.slug ?? d.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(d.slug));
  const [policy, setPolicy] = useState(v?.transferPolicy ?? d.transferPolicy ?? "allowed");
  const [category, setCategory] = useState(v?.category ?? d.category ?? "fest");
  const [venue, setVenue] = useState(v?.venue ?? d.venue ?? "");
  const [startsAt, setStartsAt] = useState(v?.startsAt ?? d.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(v?.endsAt ?? d.endsAt ?? "");
  const { ref, rev } = useFormFeedback(state);
  const [slugCheck, setSlugCheck] = useState<{ slug: string; taken: boolean } | null>(null);
  useEffect(() => {
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) return;
    let stale = false;
    const t = window.setTimeout(async () => {
      const r = await checkSlugAction(slug, d.eventId ?? null).catch(() => null);
      if (!stale && r) setSlugCheck({ slug, taken: r.taken });
    }, 400);
    return () => { stale = true; window.clearTimeout(t); };
  }, [slug, d.eventId]);
  const slugNote = slugCheck?.slug === slug ? (slugCheck.taken ? "Already used by another event. Change it." : "Free to use.") : null;

  return (
    <form ref={ref} action={action} className="flex flex-col gap-6" noValidate>
      {d.eventId && <input type="hidden" name="eventId" value={d.eventId} />}
      {d.requestId && <input type="hidden" name="requestId" value={d.requestId} />}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name} className="sm:col-span-2">
          <Input id="name" name="name" value={name} maxLength={120} autoFocus={!d.eventId} placeholder="e.g. Spring Fest 2026" onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} {...describedBy("name", fe.name)} />
        </Field>
        <div className="sm:col-span-2">
          <KindPicker key={`kind-${rev}`} value={category} onChange={setCategory} />
        </div>
        <DateTimeQuick id="startsAt" name="startsAt" label="Starts" value={startsAt} onChange={setStartsAt} error={fe.startsAt} hint="Campus time (IST)." />
        <DateTimeQuick id="endsAt" name="endsAt" label="Ends" optional value={endsAt} onChange={setEndsAt} startValue={startsAt} error={fe.endsAt} hint="Listings close when the event ends." />
        <Field label="Venue" htmlFor="venue" optional error={fe.venue} className="sm:col-span-2">
          <Input id="venue" name="venue" maxLength={120} value={venue} onChange={(e) => setVenue(e.target.value)} />
          <VenueChips value={venue} onPick={setVenue} />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={fe.slug} hint={<>/events/{slug || "…"}{slugNote && <span className={`ml-2 font-medium ${slugCheck?.taken ? "text-negative" : "text-positive"}`}>{slugNote}</span>}</>}>
          <Input id="slug" name="slug" value={slug} maxLength={80} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} {...describedBy("slug", fe.slug, true)} />
        </Field>
        <Field label="Status" htmlFor="status" error={fe.status}>
          <Select id="status" name="status" defaultValue={v?.status ?? d.status ?? "scheduled"}>
            <option value="scheduled">Scheduled</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled (takes listings out of search)</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
      </div>
      <CoverPicker current={d.coverUrl} name={name} />
      {fe.cover && <p className="-mt-4 text-[13px] font-medium text-negative" role="alert">{fe.cover}</p>}

      <Field label="Description" htmlFor="description" optional error={fe.description}>
        <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={v?.description ?? d.description ?? ""} />
      </Field>

      {/* Most events need none of this: by default anyone can resell at any price. */}
      <details className="group rounded-[10px] border border-border bg-surface open:border-control" open={policy !== "allowed" || Boolean(fe.transferPolicy || fe.policySource) || undefined}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[15px] font-semibold">Restrictions</span>
            <span className="block text-[13px] text-muted">{POLICIES.find(([p]) => p === policy)?.[1] ?? "None"}</span>
          </span>
          <span aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-180">▾</span>
        </summary>
        <div className="flex flex-col gap-5 border-t border-border px-4 pt-4 pb-5">
          <Field label="Resale rule" htmlFor="transferPolicy" error={fe.transferPolicy} hint="Only use a restriction when the organisers actually ask for one.">
            <Select id="transferPolicy" name="transferPolicy" value={policy} onChange={(e) => setPolicy(e.target.value)}>
              {POLICIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Where does this rule come from?" htmlFor="policySource" optional error={fe.policySource} hint="Who asked for it and when, e.g. “Cultural committee email, 12 Oct”. For your records.">
            <Input id="policySource" name="policySource" maxLength={300} defaultValue={v?.policySource ?? d.policySource ?? ""} {...describedBy("policySource", fe.policySource, true)} />
          </Field>
        </div>
      </details>

      {/* Tickets: what kind they are, then whether the event has levels (e.g. Normal and Fan pit). */}
      <section aria-labelledby="tickets-heading" className="flex flex-col gap-5 rounded-[10px] border border-border p-4 sm:p-5">
        <h2 id="tickets-heading" className="text-[17px] font-semibold">Tickets</h2>
        <FormatChoice
          legend="What kind of ticket does this event have?"
          hint="Sellers start from this, so they don't have to pick. Anyone with a different kind can still change it."
          defaultValue={(v?.ticketFormat as TicketFormat | "" | undefined) ?? d.ticketFormat ?? ""}
          error={fe.ticketFormat}
        />
        <TicketTypesEditor initial={v?.ticketTypes ?? d.ticketTypes} error={fe.ticketTypes} />
      </section>
      <Field label="Reason for this change" htmlFor="reason" error={fe.reason} hint="Goes in the audit log.">
        <Input id="reason" name="reason" maxLength={1000} defaultValue={v?.reason ?? ""} placeholder={d.eventId ? "e.g. Moved to the main ground" : d.requestId ? "e.g. Student request, checked the poster" : "e.g. Announced on the cultural committee page"} {...describedBy("reason", fe.reason, true)} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Saving…">{d.eventId ? "Save event" : "Create event"}</SubmitButton>
      </div>
    </form>
  );
}
