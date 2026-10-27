"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { saveEventAction } from "../actions";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

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
}

const CATEGORIES = [["fest", "Fest"], ["concert", "Concert"], ["party", "Party"], ["prom", "Prom"], ["workshop", "Workshop"], ["sports", "Sports"], ["other", "Other"]] as const;
const POLICIES = [
  ["unknown", "Unconfirmed: listings need moderator review"],
  ["allowed", "Resale allowed"],
  ["face_value_only", "Resale at face value only"],
  ["prohibited", "No resale (removes live listings)"],
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
  const [policy, setPolicy] = useState(v?.transferPolicy ?? d.transferPolicy ?? "unknown");

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {d.eventId && <input type="hidden" name="eventId" value={d.eventId} />}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" value={name} maxLength={120} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} {...describedBy("name", fe.name)} />
        </Field>
        <Field label="URL slug" htmlFor="slug" error={fe.slug} hint={`/events/${slug || "…"}`}>
          <Input id="slug" name="slug" value={slug} maxLength={80} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} {...describedBy("slug", fe.slug, true)} />
        </Field>
        <Field label="Kind" htmlFor="category" error={fe.category}>
          <Select id="category" name="category" defaultValue={v?.category ?? d.category ?? "fest"}>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Venue" htmlFor="venue" optional error={fe.venue}>
          <Input id="venue" name="venue" maxLength={120} defaultValue={v?.venue ?? d.venue ?? ""} />
        </Field>
        <Field label="Starts" htmlFor="startsAt" error={fe.startsAt} hint="Campus time (IST).">
          <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={v?.startsAt ?? d.startsAt ?? ""} {...describedBy("startsAt", fe.startsAt, true)} />
        </Field>
        <Field label="Ends" htmlFor="endsAt" optional error={fe.endsAt} hint="Listings close when the event ends.">
          <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={v?.endsAt ?? d.endsAt ?? ""} {...describedBy("endsAt", fe.endsAt, true)} />
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
      <Field label="Description" htmlFor="description" optional error={fe.description}>
        <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={v?.description ?? d.description ?? ""} />
      </Field>

      <fieldset className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-raised p-4">
        <legend className="sr-only">Resale policy</legend>
        <Field label="Resale policy" htmlFor="transferPolicy" error={fe.transferPolicy}>
          <Select id="transferPolicy" name="transferPolicy" value={policy} onChange={(e) => setPolicy(e.target.value)}>
            {POLICIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Where does this policy come from?" htmlFor="policySource" optional={policy === "unknown"} error={fe.policySource} hint="Who confirmed it and when, e.g. “Cultural committee email, 12 Oct”. Shown to students.">
          <Input id="policySource" name="policySource" maxLength={300} defaultValue={v?.policySource ?? d.policySource ?? ""} {...describedBy("policySource", fe.policySource, true)} />
        </Field>
      </fieldset>

      <Field label="Ticket types" htmlFor="ticketTypes" optional error={fe.ticketTypes} hint="One per line: name, face value in rupees. e.g. “Night pass, 800”. Existing types are kept.">
        <Textarea id="ticketTypes" name="ticketTypes" rows={3} defaultValue={v?.ticketTypes ?? d.ticketTypes ?? ""} {...describedBy("ticketTypes", fe.ticketTypes, true)} />
      </Field>
      <Field label="Reason for this change" htmlFor="reason" error={fe.reason} hint="Goes in the audit log.">
        <Input id="reason" name="reason" maxLength={1000} defaultValue={v?.reason ?? ""} placeholder={d.eventId ? "e.g. Organisers confirmed resale is fine" : "e.g. Announced on the SAC page"} {...describedBy("reason", fe.reason, true)} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Saving…">{d.eventId ? "Save event" : "Create event"}</SubmitButton>
      </div>
    </form>
  );
}
