"use client";

import { useActionState } from "react";
import { initialState } from "@/lib/action-state";
import { decide, suggest } from "./actions";
import Link from "next/link";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

const KINDS = [["", "Choose one"], ["fest", "Fest"], ["concert", "Concert"], ["party", "Party"], ["prom", "Prom"], ["workshop", "Workshop"], ["sports", "Sports"], ["other", "Something else"]] as const;
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormatChoice } from "@/components/format-choice";
import { LEVEL_PRESETS } from "@/lib/ticket-levels";
import type { TicketFormat } from "@/lib/listing-rules";

export function SuggestForm() {
  const [state, action] = useActionState(suggest, initialState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Event name" htmlFor="sg-name" error={fe.name}>
        <Input id="sg-name" name="name" maxLength={120} defaultValue={state.values?.name ?? ""} {...describedBy("sg-name", fe.name)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="When it starts" htmlFor="sg-starts" error={fe.startsAt} hint="India time.">
          <Input id="sg-starts" name="startsAt" type="datetime-local" defaultValue={state.values?.startsAt ?? ""} {...describedBy("sg-starts", fe.startsAt, true)} />
        </Field>
        <Field label="Kind of event" htmlFor="sg-kind" optional>
          <Select id="sg-kind" name="category" defaultValue={state.values?.category ?? ""}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Where" htmlFor="sg-venue" optional error={fe.venue}>
        <Input id="sg-venue" name="venue" maxLength={120} defaultValue={state.values?.venue ?? ""} placeholder="Venue or campus" />
      </Field>
      <FormatChoice
        legend="What kind of ticket is it?"
        hint="Optional. Sellers won't have to pick it themselves."
        defaultValue={(state.values?.ticketFormat as TicketFormat | "" | undefined) ?? ""}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Ticket levels <span className="font-normal text-muted">(optional)</span></legend>
        <p className="mb-2.5 text-[13px] text-muted">Tick the ones this event has. Leave them all if everyone gets the same ticket.</p>
        <div className="flex flex-wrap gap-1.5">
          {LEVEL_PRESETS.map((level) => (
            <label
              key={level}
              className="inline-flex h-9 cursor-pointer items-center rounded-full border border-border bg-surface px-3.5 text-[14px] font-medium transition-[border-color,background-color] hover:border-control-hover has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input type="checkbox" name="ticketTypes" value={level} className="sr-only" />
              {level}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Other levels" htmlFor="sg-other-types" optional hint="Separate them with commas, e.g. Gold stand, Silver stand.">
            <Input id="sg-other-types" name="otherTypes" maxLength={300} defaultValue={state.values?.otherTypes ?? ""} />
          </Field>
        </div>
      </fieldset>
      <Field label="Anything that helps" htmlFor="sg-details" optional hint="Who's organising it, or where it was announced. Shown on the event page once it's approved.">
        <Textarea id="sg-details" name="details" rows={2} maxLength={1000} defaultValue={state.values?.details ?? ""} />
      </Field>
      <div>
        <SubmitButton variant="dark" pendingLabel="Sending…">Send for approval</SubmitButton>
      </div>
    </form>
  );
}

export function DecideSuggestion({ id }: { id: string }) {
  const [state, action] = useActionState(decide, initialState);
  if (state.ok) return <span className="text-sm text-muted">{state.message}</span>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Input name="note" aria-label="Note for the student (optional)" placeholder="Note for the student (optional)" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="status" value="approve" variant="buy" size="sm" pendingLabel="Publishing…">Approve &amp; publish</SubmitButton>
        <Link href={`/admin/events/new?request=${id}`} className={buttonClass("secondary", "sm")}>Edit first</Link>
        <SubmitButton name="status" value="declined" variant="ghost" size="sm" pendingLabel="Saving…">Decline</SubmitButton>
      </div>
    </form>
  );
}
