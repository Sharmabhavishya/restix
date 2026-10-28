"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { sellerActionsFor, type ListingStatus, type SellerAction } from "@/lib/listing-rules";
import { contactSeller, listingAction, reportListing } from "../actions";
import { Field, Select, Textarea, Input, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { unitPrice } from "@/lib/listing-rules";
import { ChevronDown, Lock, Minus, Plus } from "lucide-react";

export function ContactForm({
  listingId, maxQuantity, sellerName, negotiable, askingPricePaise, bulkMinQuantity, bulkPricePaise, savedWhatsapp,
}: {
  listingId: string;
  maxQuantity: number;
  sellerName: string;
  negotiable: boolean;
  askingPricePaise: number;
  bulkMinQuantity: number | null;
  bulkPricePaise: number | null;
  /** The buyer's saved WhatsApp number, if any (shown masked). */
  savedWhatsapp: string | null;
}) {
  const [state, action] = useActionState(contactSeller, initialState);
  const fe = state.fieldErrors ?? {};
  const [share, setShare] = useState(state.values ? state.values.shareWhatsapp === "on" : true);
  const [qty, setQty] = useState(() => Math.min(maxQuantity, Math.max(1, Number(state.values?.quantity ?? 1) || 1)));
  if (state.ok) {
    return <Notice tone="success" title="Request sent">{state.message}</Notice>;
  }
  const each = unitPrice({ askingPricePaise, bulkMinQuantity, bulkPricePaise }, qty);
  const dealOn = each < askingPricePaise;
  const toDeal = bulkMinQuantity !== null && bulkPricePaise !== null && qty < bulkMinQuantity && bulkMinQuantity <= maxQuantity ? bulkMinQuantity - qty : 0;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="quantity" value={qty} />
      {state.error && <Notice tone="error">{state.error}</Notice>}

      {/* The quick path: how many, what it comes to, one button. */}
      <div className="flex items-center justify-between gap-4 rounded-[10px] bg-raised px-4 py-3">
        {maxQuantity > 1 ? (
          <div className="flex items-center gap-1" role="group" aria-label="How many tickets">
            <QtyButton label="One fewer" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="size-4" /></QtyButton>
            <span className="num w-10 text-center text-lg font-semibold" aria-live="polite">{qty}</span>
            <QtyButton label="One more" disabled={qty >= maxQuantity} onClick={() => setQty((q) => Math.min(maxQuantity, q + 1))}><Plus className="size-4" /></QtyButton>
          </div>
        ) : (
          <span className="text-sm text-muted">1 ticket</span>
        )}
        <div className="text-right">
          <p className={`num text-xl leading-none font-bold ${dealOn ? "text-price-low" : ""}`}>{formatPaise(each * qty)}</p>
          <p className="mt-1 text-[12px] text-muted">{qty > 1 ? `${formatPaise(each)} each${dealOn ? ", deal price" : ""}` : "total"}</p>
        </div>
      </div>
      {toDeal > 0 && (
        <p className="-mt-2 text-[13px] font-medium text-price-low">
          Add {toDeal} more to get {formatPaise(bulkPricePaise!)} each.
        </p>
      )}

      {/* Private until accepted: the core promise, said where the decision is made. */}
      <div className="rounded-[10px] border border-border px-3 py-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="shareWhatsapp" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-accent" />
          <span className="text-sm leading-snug">
            <span className="font-medium">Let {sellerName.split(/\s+/)[0]} WhatsApp me if they say yes</span>
            <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
              <Lock className="size-3.5 flex-none" aria-hidden />
              {savedWhatsapp ? `Your number (•••• ${savedWhatsapp.slice(-4)}) stays hidden until then.` : "Your number stays hidden until then."}
            </span>
          </span>
        </label>
        {share && !savedWhatsapp && (
          <div className="mt-3 pl-[30px]">
            <PhoneInput name="whatsapp" aria-label="Your WhatsApp number" defaultValue={state.values?.whatsapp ?? ""} aria-invalid={fe.whatsapp ? true : undefined} />
            {fe.whatsapp && <p className="mt-1.5 text-[13px] font-medium text-negative" role="alert">{fe.whatsapp}</p>}
          </div>
        )}
      </div>

      {negotiable && (
        <details className="group" open={Boolean(fe.offer) || undefined}>
          <summary className="tap cursor-pointer list-none text-[14px] font-medium text-accent-strong underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            Don&apos;t like the price? Make an offer
          </summary>
          <div className="mt-3">
            <Field
              label="Your offer per ticket (₹)"
              htmlFor="offer"
              optional
              error={fe.offer}
              hint={`The seller can take it, counter or pass. It can't go above ${formatPaise(each)}.`}
            >
              <Input id="offer" name="offer" inputMode="decimal" placeholder={String(Math.round((each * 0.9) / 100))} defaultValue={state.values?.offer ?? ""} className="w-36" {...describedBy("offer", fe.offer, true)} />
            </Field>
          </div>
        </details>
      )}

      <details className="group rounded-[10px] border border-border" open={Boolean(fe.message) || undefined}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Add a note
          <ChevronDown className="size-4 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border px-3 pt-3 pb-4">
          <Field label={`Message to ${sellerName}`} htmlFor="message" error={fe.message} hint="Say when you could meet. Don't send money before you have the ticket.">
            <Textarea
              id="message"
              name="message"
              rows={3}
              maxLength={1000}
              required
              defaultValue={state.values?.message ?? "Hey! Is this still available? I could meet whenever works for you."}
              {...describedBy("message", fe.message, true)}
            />
          </Field>
        </div>
      </details>

      <SubmitButton size="lg" variant="buy" pendingLabel="Sending…">
        Request {qty === 1 ? "this ticket" : `${qty} tickets`}
      </SubmitButton>
      <p className="-mt-1 text-center text-[12px] text-muted">Free. The seller sees your name, never your email or number.</p>
    </form>
  );
}

function QtyButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-10 place-items-center rounded-full border border-control bg-surface transition-transform duration-150 hover:border-control-hover active:scale-90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const ACTION_LABEL: Partial<Record<SellerAction, string>> = {
  publish: "Publish",
  resume: "Resume",
  pause: "Pause",
  mark_sold: "Mark sold",
  mark_unavailable: "Take down",
  withdraw: "Back to draft",
  delete: "Delete",
};

export function OwnerActions({ listingId, version, status }: { listingId: string; version: number; status: ListingStatus }) {
  const [state, action] = useActionState(listingAction, initialState);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actions = sellerActionsFor(status).filter((a) => a !== "edit");
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="version" value={version} />
        {actions
          .filter((a) => a !== "delete")
          .map((a) => (
            <SubmitButton key={a} name="action" value={a} variant={a === (actions.includes("resume") ? "resume" : actions.includes("publish") ? "publish" : "mark_sold") ? "primary" : "secondary"} pendingLabel="Saving…">
              {ACTION_LABEL[a]}
            </SubmitButton>
          ))}
        {actions.includes("delete") &&
          (confirmDelete ? (
            <SubmitButton name="action" value="delete" variant="danger" pendingLabel="Deleting…">
              Yes, delete it
            </SubmitButton>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass("ghost", "md", "text-negative")}>
              Delete
            </button>
          ))}
      </form>
    </div>
  );
}

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState(reportListing, initialState);
  const [open, setOpen] = useState(false);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="tap text-sm text-muted underline hover:text-ink">
        Something off? Report this listing
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="What's wrong?" htmlFor="reason" error={fe.reason}>
        <Select id="reason" name="reason" defaultValue={(state.values?.reason as ReportReason) ?? ""} required {...describedBy("reason", fe.reason)}>
          <option value="" disabled>Choose a reason</option>
          {Object.entries(REPORT_REASONS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <Field label="Details" htmlFor="details" optional hint="What happened? Moderators see this; the seller doesn't see who reported." error={fe.details}>
        <Textarea id="details" name="details" rows={3} maxLength={2000} defaultValue={state.values?.details ?? ""} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton variant="dark" pendingLabel="Sending…">Send report</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Cancel</button>
      </div>
    </form>
  );
}
