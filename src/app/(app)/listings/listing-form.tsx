"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Coins, IdCard, Mail, Minus, Plus, QrCode, Ribbon, Shapes, Smartphone, Ticket, type LucideIcon } from "lucide-react";
import { initialState } from "@/lib/action-state";
import {
  FORMAT_HINT, FORMAT_LABEL, FORMATS, HANDOVER_LABEL, handoversFor, defaultHandover,
  type HandoverMethod, type TicketFormat, type TransferPolicy,
} from "@/lib/listing-rules";
import { dealFor, TIER_LABEL } from "@/lib/deal";
import { formatPaise, paiseToInput, parseRupees } from "@/lib/money";
import { formatDateTime, toLocalInput } from "@/lib/format";
import { saveListing } from "./actions";
import { Field, Input, Select, Textarea, Checkbox, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { PRICE_TONE, TicketCard } from "@/components/ticket-card";

const FORMAT_ICON: Record<TicketFormat, LucideIcon> = {
  wristband: Ribbon, paper: Ticket, qr: QrCode, email: Mail, app: Smartphone, pass: IdCard, token: Coins, other: Shapes,
};

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
  /** Students looking for tickets to it. */
  wants?: number;
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
  bulkMinQuantity?: number | null;
  bulkPricePaise?: number | null;
  handoverMethod?: HandoverMethod;
  meetupArea?: string | null;
  handoverNotes?: string | null;
  sellerNotes?: string | null;
  expiresAt?: string | null;
}

/**
 * Listing in three answers: which event, what kind of ticket, how many for how much. Everything
 * else (offers, multi-ticket deals, handover details, notes) sits in "more options" sections that
 * stay shut unless you open them or something in them needs fixing.
 */
export function ListingForm({ events, defaults = {}, editing = false }: { events: FormEvent[]; defaults?: ListingDefaults; editing?: boolean }) {
  const [state, action] = useActionState(saveListing, initialState);
  const v = state.values;
  const fe = state.fieldErrors ?? {};
  const [eventId, setEventId] = useState(v?.eventId ?? defaults.eventId ?? "");
  const event = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const [ticketTypeId, setTicketTypeId] = useState(v?.ticketTypeId ?? defaults.ticketTypeId ?? event?.ticketTypes[0]?.id ?? "");
  const ticketType = event?.ticketTypes.find((t) => t.id === ticketTypeId);
  const [format, setFormat] = useState<TicketFormat>(((v?.format === "digital" ? "qr" : v?.format) as TicketFormat) ?? defaults.format ?? "wristband");
  const [quantity, setQuantity] = useState(() => clampQty(Number(v?.quantity ?? defaults.quantity ?? 1)));
  const [price, setPrice] = useState(v?.askingPrice ?? paiseToInput(defaults.askingPricePaise));
  // Bargaining is on unless the seller turns it off (an existing listing keeps its own setting).
  const [negotiable, setNegotiable] = useState(v ? v.priceNegotiable === "on" : defaults.priceNegotiable ?? true);
  const [bulkMin, setBulkMin] = useState(v?.bulkMinQuantity ?? (defaults.bulkMinQuantity ? String(defaults.bulkMinQuantity) : ""));
  const [bulkPrice, setBulkPrice] = useState(v?.bulkPrice ?? paiseToInput(defaults.bulkPricePaise ?? null));
  const [meetup, setMeetup] = useState(v?.meetupArea ?? defaults.meetupArea ?? "");

  const pricePaise = parseRupees(price);
  const bulkPricePaise = parseRupees(bulkPrice);
  // A deal threshold above the quantity (after lowering it) no longer applies.
  const bulkMinN = Number(bulkMin) <= quantity ? Number(bulkMin) : 0;
  const handovers = handoversFor(format);
  const faceValue = ticketType?.faceValuePaise ?? null;
  const capped = event?.transferPolicy === "face_value_only";
  const deal = pricePaise !== null ? dealFor({ askingPricePaise: pricePaise, faceValuePaise: faceValue }) : null;
  const blocked = event?.status === "cancelled" || event?.transferPolicy === "prohibited";
  const needsPaid = capped && faceValue === null;

  const opened = (keys: string[], hasDefault = false) => keys.some((k) => fe[k]) || hasDefault || undefined;

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      {/* Live preview: the exact card people will see, changing shape with the kind of ticket. */}
      <section aria-label="Preview" className="z-10 -mx-1 flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface/95 px-1 pt-3 pb-3 backdrop-blur-sm md:sticky md:top-4">
        <p className="text-[13px] text-muted">{event ? "preview · this is how it shows up" : "preview · pick an event to see yours"}</p>
        <div aria-hidden className="pt-1">
          <TicketCard
            listing={{
              id: defaults.listingId ?? "preview",
              eventId: event?.id ?? "preview",
              eventName: event?.name ?? "Your event",
              eventStartsAt: new Date(event?.startsAt ?? Date.parse("2026-11-05T13:30:00Z")),
              eventIsFixture: event?.isFixture,
              ticketTypeName: ticketType?.name ?? "Ticket",
              format,
              quantity,
              askingPricePaise: pricePaise ?? 0,
              faceValuePaise: faceValue,
              priceNegotiable: negotiable,
              bulkMinQuantity: bulkMinN >= 2 && bulkPricePaise !== null ? bulkMinN : null,
              bulkPricePaise: bulkMinN >= 2 ? bulkPricePaise : null,
              meetupArea: meetup || null,
            }}
            pricePending={pricePaise === null}
          />
        </div>
      </section>
      {defaults.listingId && <input type="hidden" name="listingId" value={defaults.listingId} />}
      {defaults.version !== undefined && <input type="hidden" name="version" value={defaults.version} />}
      {state.error && <Notice tone="error" title="Not saved">{state.error}</Notice>}

      {/* 1. Which event */}
      <Step n={1} title="Which event?">
        <Field
          label="Event"
          htmlFor="eventId"
          error={fe.eventId}
          hint={editing ? undefined : <Link href="/sell?add=1#add-event" className="tap font-medium text-accent-strong underline-offset-2 hover:underline">Can&apos;t find it? Add your event</Link>}
        >
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
        {event && (event.wants ?? 0) > 0 && (
          <p className="-mt-2 flex items-center gap-2 rounded-[10px] bg-sticker/30 px-3 py-2 text-[14px] font-medium text-ink">
            <span aria-hidden>🙋</span> {event.wants} {event.wants === 1 ? "person is" : "people are"} looking for tickets to this.
          </p>
        )}
        {blocked && <Notice tone="error" title="Can't list for this event">Tickets for this event can&apos;t be resold right now.</Notice>}
        {event && event.ticketTypes.length > 1 ? (
          <Field label="Ticket type" htmlFor="ticketTypeId" error={fe.ticketTypeId}>
            <Select id="ticketTypeId" name="ticketTypeId" required value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)} {...describedBy("ticketTypeId", fe.ticketTypeId)}>
              {event.ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.faceValuePaise !== null ? ` · face value ${formatPaise(t.faceValuePaise)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="ticketTypeId" value={ticketTypeId} />
        )}
      </Step>

      {/* 2. What kind of ticket */}
      <Step n={2} title="What kind of ticket?">
        <fieldset>
          <legend className="sr-only">Kind of ticket</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMATS.map((f) => {
              const Icon = FORMAT_ICON[f];
              const on = format === f;
              return (
                <label
                  key={f}
                  className={`group/fmt flex min-h-[4.5rem] cursor-pointer flex-col justify-between gap-2 rounded-[10px] border px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out-expo)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent motion-safe:active:scale-[0.97] ${
                    on ? "border-accent bg-accent-soft text-accent-ink" : "border-control bg-surface hover:border-control-hover"
                  }`}
                >
                  <input type="radio" name="format" value={f} checked={on} onChange={() => setFormat(f)} className="sr-only" />
                  <Icon className={`size-5 transition-transform duration-300 motion-safe:group-hover/fmt:-rotate-12 ${on ? "text-accent-strong" : "text-muted"}`} strokeWidth={1.75} aria-hidden />
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{FORMAT_LABEL[f]}</span>
                    <span className={`block text-[12px] ${on ? "text-accent-ink/80" : "text-muted"}`}>{FORMAT_HINT[f]}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {fe.format && <p className="mt-2 text-[13px] font-medium text-negative">{fe.format}</p>}
        </fieldset>
      </Step>

      {/* 3. How many, how much */}
      <Step n={3} title="How many, and for how much?">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <Field label="Tickets" htmlFor="quantity" error={fe.quantity}>
            <div className="flex h-11 items-center gap-1 sm:h-10">
              <StepButton label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => clampQty(q - 1))}><Minus className="size-4" /></StepButton>
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(clampQty(Number(e.target.value)))}
                className="num h-full w-14 rounded-[var(--radius-control)] border border-control bg-surface text-center text-[17px] font-semibold focus:border-accent focus:ring-3 focus:ring-accent-track focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                {...describedBy("quantity", fe.quantity)}
              />
              <StepButton label="One more" disabled={quantity >= 10} onClick={() => setQuantity((q) => clampQty(q + 1))}><Plus className="size-4" /></StepButton>
            </div>
          </Field>
          <Field
            label={quantity > 1 ? "Price per ticket" : "Price"}
            htmlFor="askingPrice"
            error={fe.askingPrice}
            hint={<PriceHint tier={deal?.tier ?? null} saving={deal?.saving ?? null} face={faceValue} capped={capped} />}
          >
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[17px] font-semibold text-muted">₹</span>
              <Input
                id="askingPrice"
                name="askingPrice"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={faceValue !== null ? paiseToInput(faceValue) : "800"}
                className="num pl-7 text-[17px] font-semibold"
                {...describedBy("askingPrice", fe.askingPrice, true)}
              />
            </div>
          </Field>
        </div>
        {needsPaid && (
          <Field label="What you paid per ticket (₹)" htmlFor="originalPrice" error={fe.originalPrice} hint="This event only allows resale at face value, so buyers see what you paid.">
            <Input id="originalPrice" name="originalPrice" inputMode="decimal" defaultValue={v?.originalPrice ?? paiseToInput(defaults.originalPricePaise ?? null)} {...describedBy("originalPrice", fe.originalPrice, true)} />
          </Field>
        )}
      </Step>

      {/* The extras: shut by default, opened by errors or by values already set. */}
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-muted">More options <span className="font-normal">· all optional</span></p>

        <More title="Offers and deals" sub={dealSummary(negotiable, bulkMinN, bulkPricePaise)} open={opened(["bulkMinQuantity", "bulkPrice", "originalPrice"], Boolean(defaults.bulkMinQuantity))}>
          <Checkbox id="priceNegotiable" name="priceNegotiable" label="Open to offers" hint="On by default. Buyers can suggest a price; you take it, counter or pass. Untick for a fixed price." checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Multi-ticket deal</legend>
            <p className="text-[13px] text-muted">
              {quantity < 2 ? "List 2 or more tickets to offer a lower price for buying several." : "A lower price per ticket for anyone taking several, like 3+ for ₹700 each."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="When buying at least" htmlFor="bulkMinQuantity" error={fe.bulkMinQuantity}>
                <Select id="bulkMinQuantity" name="bulkMinQuantity" value={bulkMinN >= 2 ? bulkMin : ""} onChange={(e) => setBulkMin(e.target.value)} disabled={quantity < 2} {...describedBy("bulkMinQuantity", fe.bulkMinQuantity)}>
                  <option value="">No deal</option>
                  {Array.from({ length: Math.max(0, quantity - 1) }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n} tickets</option>
                  ))}
                </Select>
              </Field>
              <Field label="Price each (₹)" htmlFor="bulkPrice" error={fe.bulkPrice}>
                <Input id="bulkPrice" name="bulkPrice" inputMode="decimal" value={bulkMinN >= 2 ? bulkPrice : ""} onChange={(e) => setBulkPrice(e.target.value)} disabled={bulkMinN < 2} placeholder={pricePaise ? paiseToInput(Math.round(pricePaise * 0.85)) : ""} {...describedBy("bulkPrice", fe.bulkPrice)} />
              </Field>
            </div>
          </fieldset>
          {!needsPaid && (
            <Field label="What you paid per ticket (₹)" htmlFor="originalPrice" optional={!capped} error={fe.originalPrice} hint="Shown to buyers so they can compare.">
              <Input id="originalPrice" name="originalPrice" inputMode="decimal" defaultValue={v?.originalPrice ?? paiseToInput(defaults.originalPricePaise ?? faceValue)} key={ticketTypeId} {...describedBy("originalPrice", fe.originalPrice, true)} />
            </Field>
          )}
        </More>

        <More title="Handover" sub={`${HANDOVER_LABEL[defaults.handoverMethod && handovers.includes(defaults.handoverMethod) ? defaults.handoverMethod : defaultHandover(format)]}${meetup ? ` · ${meetup}` : ""}`} open={opened(["handoverMethod", "meetupArea", "handoverNotes"])}>
          {handovers.length > 1 ? (
            <Field label="How" htmlFor="handoverMethod" error={fe.handoverMethod}>
              <Select id="handoverMethod" name="handoverMethod" defaultValue={v?.handoverMethod ?? defaults.handoverMethod ?? handovers[0]} key={format} {...describedBy("handoverMethod", fe.handoverMethod)}>
                {handovers.map((h) => <option key={h} value={h}>{HANDOVER_LABEL[h]}</option>)}
              </Select>
            </Field>
          ) : (
            <p className="text-[13px] text-muted">
              {format === "app" ? "App transfers happen inside the ticketing app." : `${FORMAT_LABEL[format]}s are physical, so they're handed over in person.`}
            </p>
          )}
          <Field label="Meetup spot" htmlFor="meetupArea" optional error={fe.meetupArea} hint="Somewhere public and busy, like a café or the main gate. Never your room.">
            <Input id="meetupArea" name="meetupArea" maxLength={80} value={meetup} onChange={(e) => setMeetup(e.target.value)} {...describedBy("meetupArea", fe.meetupArea, true)} />
          </Field>
          <Field label="Handover notes" htmlFor="handoverNotes" optional error={fe.handoverNotes} hint="When you're free, anything the buyer should know.">
            <Textarea id="handoverNotes" name="handoverNotes" maxLength={500} rows={2} defaultValue={v?.handoverNotes ?? defaults.handoverNotes ?? ""} {...describedBy("handoverNotes", fe.handoverNotes, true)} />
          </Field>
        </More>

        <More title="Notes and timing" sub="Public note, when it comes down" open={opened(["sellerNotes", "expiresAt"])}>
          <Field label="Anything else" htmlFor="sellerNotes" optional error={fe.sellerNotes} hint="Public. Keep phone numbers and handles out; you share those when you accept a request.">
            <Textarea id="sellerNotes" name="sellerNotes" maxLength={1000} rows={3} defaultValue={v?.sellerNotes ?? defaults.sellerNotes ?? ""} {...describedBy("sellerNotes", fe.sellerNotes, true)} />
          </Field>
          <Field
            label="Take the listing down at"
            htmlFor="expiresAt"
            optional
            error={fe.expiresAt}
            hint={event ? `Otherwise it comes down when the event ends (${formatDateTime(new Date(event.closesAt))}).` : "Otherwise it comes down when the event ends."}
          >
            <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={v?.expiresAt ?? defaults.expiresAt ?? ""} max={event ? toLocalInput(new Date(event.closesAt)) : undefined} {...describedBy("expiresAt", fe.expiresAt, true)} />
          </Field>
        </More>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <SubmitButton name="intent" value="publish" disabled={blocked} pendingLabel="Saving…" size="lg" className="sm:min-w-48">
          {editing ? "Save changes" : "Publish listing"}
        </SubmitButton>
        {!editing && (
          <SubmitButton name="intent" value="draft" variant="ghost" size="lg" pendingLabel="Saving…">
            Save as draft
          </SubmitButton>
        )}
        <p className="text-[13px] text-muted sm:ml-auto sm:max-w-[30ch] sm:text-right">
          ResTix never takes money. You and the buyer settle up at the handover.
        </p>
      </div>
    </form>
  );
}

function clampQty(n: number): number {
  return Number.isInteger(n) ? Math.min(10, Math.max(1, n)) : 1;
}

function dealSummary(negotiable: boolean, bulkMin: number, bulkPrice: number | null): string {
  const bits = [negotiable ? "Open to offers" : "Fixed price"];
  if (bulkMin >= 2 && bulkPrice !== null) bits.push(`${bulkMin}+ for ${formatPaise(bulkPrice)} each`);
  return bits.join(" · ");
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="flex flex-col gap-4">
      <h2 id={`step-${n}`} className="flex items-center gap-3 font-display text-xl font-bold tracking-[-0.01em]">
        <span aria-hidden className="num grid size-7 place-items-center rounded-full bg-primary text-[13px] font-semibold text-on-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-control bg-surface transition-transform duration-150 hover:border-control-hover active:scale-90 disabled:opacity-40 sm:size-10"
    >
      {children}
    </button>
  );
}

function More({ title, sub, open, children }: { title: string; sub: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-[10px] border border-border bg-surface open:border-control">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block truncate text-[13px] text-muted">{sub}</span>
        </span>
        <ChevronDown className="size-4 flex-none text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-5 border-t border-border px-4 pt-4 pb-5">{children}</div>
    </details>
  );
}

/** What the price says to a buyer, said back to the seller as they type. */
function PriceHint({ tier, saving, face, capped }: { tier: ReturnType<typeof dealFor>["tier"]; saving: number | null; face: number | null; capped: boolean }) {
  if (capped && face !== null) {
    return (
      <span>
        Max {formatPaise(face)} here (face value).
        {tier && <span className={`ml-1 font-medium ${PRICE_TONE[tier]}`}>{TIER_LABEL[tier]}{saving ? `, ${saving}% under` : ""}.</span>}
      </span>
    );
  }
  if (!tier || face === null) return <span>What you want for each ticket.</span>;
  const words: Record<NonNullable<typeof tier>, string> = {
    steal: `${saving}% under face value. This will go fast.`,
    good: `${saving}% under face value. Buyers will notice.`,
    fair: "Around face value. Fair.",
    high: "Above face value. Some buyers will scroll past.",
    steep: "Well above face value. Expect fewer requests.",
  };
  return <span className={`font-medium ${PRICE_TONE[tier]}`}>{words[tier]}</span>;
}
