"use client";

import { useActionState, useMemo, useState } from "react";
import { initialState } from "@/lib/action-state";
import { FORMAT_LABEL, HANDOVER_LABEL, POLICY_LABEL, type HandoverMethod, type TicketFormat, type TransferPolicy } from "@/lib/listing-rules";
import { formatPaise, paiseToInput } from "@/lib/money";
import { formatDateTime, toLocalInput } from "@/lib/format";
import { saveListing } from "./actions";
import { Field, Input, Select, Textarea, Checkbox, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

export interface FormEvent {
  id: string;
  name: string;
  startsAt: string;
  closesAt: string;
  status: string;
  transferPolicy: TransferPolicy;
  policySource: string | null;
  isFixture: boolean;
  ticketTypes: { id: string; name: string; faceValuePaise: number | null }[];
}

export interface ListingDefaults {
  listingId?: string;
  version?: number;
  eventId?: string;
  ticketTypeId?: string;
  format?: TicketFormat;
  quantity?: number;
  askingPricePaise?: number;
  originalPricePaise?: number | null;
  priceNegotiable?: boolean;
  handoverMethod?: HandoverMethod;
  meetupArea?: string | null;
  handoverNotes?: string | null;
  sellerNotes?: string | null;
  expiresAt?: string | null;
}

const POLICY_HELP: Record<TransferPolicy, string> = {
  allowed: "The organisers allow resale. Your listing goes live straight away.",
  face_value_only: "Resale is allowed at face value or less. Add the original price; you can't ask for more.",
  unknown: "Nobody has confirmed the resale rules yet, so a moderator checks your listing before it goes live.",
  prohibited: "The organisers don't allow these tickets to be resold. You can't list them.",
};

export function ListingForm({ events, defaults = {}, editing = false }: { events: FormEvent[]; defaults?: ListingDefaults; editing?: boolean }) {
  const [state, action] = useActionState(saveListing, initialState);
  const v = state.values;
  const fe = state.fieldErrors ?? {};
  const [eventId, setEventId] = useState(v?.eventId ?? defaults.eventId ?? "");
  const [format, setFormat] = useState<TicketFormat>((v?.format as TicketFormat) ?? defaults.format ?? "wristband");
  const event = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const [ticketTypeId, setTicketTypeId] = useState(v?.ticketTypeId ?? defaults.ticketTypeId ?? "");
  const ticketType = event?.ticketTypes.find((t) => t.id === ticketTypeId);

  const blocked = event?.transferPolicy === "prohibited" || event?.status === "cancelled";
  const handoverOptions = (Object.keys(HANDOVER_LABEL) as HandoverMethod[]).filter((h) => format !== "wristband" || h === "in_person");

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      {defaults.listingId && <input type="hidden" name="listingId" value={defaults.listingId} />}
      {defaults.version !== undefined && <input type="hidden" name="version" value={defaults.version} />}
      {state.error && <Notice tone="error" title="Not saved">{state.error}</Notice>}

      <section aria-labelledby="what" className="flex flex-col gap-5">
        <h2 id="what" className="text-lg font-semibold">What are you selling?</h2>
        <Field label="Event" htmlFor="eventId" error={fe.eventId}>
          <Select
            id="eventId"
            name="eventId"
            required
            disabled={editing}
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setTicketTypeId(events.find((x) => x.id === e.target.value)?.ticketTypes[0]?.id ?? "");
            }}
            {...describedBy("eventId", fe.eventId)}
          >
            <option value="" disabled>Choose an event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {formatDateTime(new Date(e.startsAt))}
                {e.isFixture ? " (sample)" : ""}
              </option>
            ))}
          </Select>
          {editing && <input type="hidden" name="eventId" value={eventId} />}
        </Field>

        {event && (
          <Notice tone={blocked ? "error" : event.transferPolicy === "allowed" ? "success" : "warning"} title={event.status === "cancelled" ? "Event cancelled" : POLICY_LABEL[event.transferPolicy]}>
            {event.status === "cancelled" ? "This event was cancelled, so tickets can't be listed." : POLICY_HELP[event.transferPolicy]}
            {event.policySource && <span className="mt-1 block text-[13px] opacity-80">Source: {event.policySource}</span>}
          </Notice>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Ticket type" htmlFor="ticketTypeId" error={fe.ticketTypeId}>
            <Select id="ticketTypeId" name="ticketTypeId" required value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)} disabled={!event} {...describedBy("ticketTypeId", fe.ticketTypeId)}>
              <option value="" disabled>{event ? "Choose a type" : "Pick the event first"}</option>
              {event?.ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.faceValuePaise !== null ? ` · face value ${formatPaise(t.faceValuePaise)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How many?" htmlFor="quantity" error={fe.quantity} hint="Up to 10 in one listing.">
            <Input id="quantity" name="quantity" type="number" min={1} max={10} step={1} inputMode="numeric" defaultValue={v?.quantity ?? defaults.quantity ?? 1} {...describedBy("quantity", fe.quantity, true)} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Format</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(FORMAT_LABEL) as TicketFormat[]).map((f) => (
              <label
                key={f}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  format === f ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-control bg-surface hover:border-control-hover"
                }`}
              >
                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                {FORMAT_LABEL[f]}
              </label>
            ))}
          </div>
          {fe.format && <p className="mt-2 text-[13px] font-medium text-negative">{fe.format}</p>}
        </fieldset>
      </section>

      <section aria-labelledby="price" className="flex flex-col gap-5">
        <h2 id="price" className="text-lg font-semibold">Price</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Asking price per ticket (₹)"
            htmlFor="askingPrice"
            error={fe.askingPrice}
            hint={event?.transferPolicy === "face_value_only" && ticketType?.faceValuePaise ? `Max ${formatPaise(ticketType.faceValuePaise)} for this event.` : "What you want for each ticket."}
          >
            <Input id="askingPrice" name="askingPrice" inputMode="decimal" required defaultValue={v?.askingPrice ?? paiseToInput(defaults.askingPricePaise)} placeholder="800" {...describedBy("askingPrice", fe.askingPrice, true)} />
          </Field>
          <Field label="What you paid (₹)" htmlFor="originalPrice" optional={event?.transferPolicy !== "face_value_only"} error={fe.originalPrice} hint="Shown to buyers so they can compare.">
            <Input
              id="originalPrice"
              name="originalPrice"
              inputMode="decimal"
              defaultValue={v?.originalPrice ?? paiseToInput(defaults.originalPricePaise ?? ticketType?.faceValuePaise ?? null)}
              key={ticketTypeId}
              {...describedBy("originalPrice", fe.originalPrice, true)}
            />
          </Field>
        </div>
        <Checkbox id="priceNegotiable" name="priceNegotiable" label="Open to offers" defaultChecked={v ? v.priceNegotiable === "on" : defaults.priceNegotiable} />
        <p className="text-[13px] text-muted">
          Payment happens between you and the buyer. ResTix never takes money, holds it, or handles refunds.
        </p>
      </section>

      <section aria-labelledby="handover" className="flex flex-col gap-5">
        <h2 id="handover" className="text-lg font-semibold">Handover</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="How" htmlFor="handoverMethod" error={fe.handoverMethod} hint={format === "wristband" ? "Wristbands are physical, so they're handed over in person." : undefined}>
            <Select id="handoverMethod" name="handoverMethod" defaultValue={v?.handoverMethod ?? defaults.handoverMethod ?? "in_person"} key={format} {...describedBy("handoverMethod", fe.handoverMethod, format === "wristband")}>
              {handoverOptions.map((h) => (
                <option key={h} value={h}>{HANDOVER_LABEL[h]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Meetup spot" htmlFor="meetupArea" optional error={fe.meetupArea} hint="A public spot on campus, like the library steps. Never your room.">
            <Input id="meetupArea" name="meetupArea" maxLength={80} defaultValue={v?.meetupArea ?? defaults.meetupArea ?? ""} {...describedBy("meetupArea", fe.meetupArea, true)} />
          </Field>
        </div>
        <Field label="Handover notes" htmlFor="handoverNotes" optional error={fe.handoverNotes} hint="When you're free, anything the buyer should know.">
          <Textarea id="handoverNotes" name="handoverNotes" maxLength={500} rows={2} defaultValue={v?.handoverNotes ?? defaults.handoverNotes ?? ""} {...describedBy("handoverNotes", fe.handoverNotes, true)} />
        </Field>
        <Field label="Anything else" htmlFor="sellerNotes" optional error={fe.sellerNotes} hint="Public. Keep phone numbers and handles out; you share those when you accept a request.">
          <Textarea id="sellerNotes" name="sellerNotes" maxLength={1000} rows={3} defaultValue={v?.sellerNotes ?? defaults.sellerNotes ?? ""} {...describedBy("sellerNotes", fe.sellerNotes, true)} />
        </Field>
        <Field
          label="Take the listing down at"
          htmlFor="expiresAt"
          optional
          error={fe.expiresAt}
          hint={event ? `Defaults to when the event ends (${formatDateTime(new Date(event.closesAt))}).` : "Defaults to when the event ends."}
        >
          <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={v?.expiresAt ?? defaults.expiresAt ?? ""} max={event ? toLocalInput(new Date(event.closesAt)) : undefined} {...describedBy("expiresAt", fe.expiresAt, true)} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <SubmitButton name="intent" value="publish" disabled={blocked} pendingLabel="Saving…" size="lg">
          {editing ? "Save changes" : event?.transferPolicy === "unknown" ? "Send for review" : "Publish listing"}
        </SubmitButton>
        {!editing && (
          <SubmitButton name="intent" value="draft" variant="secondary" size="lg" pendingLabel="Saving…">
            Save as draft
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
