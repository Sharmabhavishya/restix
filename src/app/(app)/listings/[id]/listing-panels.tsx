"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { REPORT_REASONS, type ReportReason } from "@/lib/validation";
import { sellerActionsFor, type ListingStatus, type SellerAction } from "@/lib/listing-rules";
import { contactSeller, listingAction, reportListing } from "../actions";
import { Field, Select, Textarea, Input, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";

export function ContactForm({ listingId, maxQuantity, sellerName, negotiable, askingPricePaise }: { listingId: string; maxQuantity: number; sellerName: string; negotiable: boolean; askingPricePaise: number }) {
  const [state, action] = useActionState(contactSeller, initialState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) {
    return <Notice tone="success" title="Request sent">{state.message}</Notice>;
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label={`Message to ${sellerName}`} htmlFor="message" error={fe.message} hint="Say when you could meet. Don't send money before you have the ticket.">
        <Textarea
          id="message"
          name="message"
          rows={3}
          maxLength={1000}
          required
          defaultValue={state.values?.message ?? "Hey! Is this still available? I could meet "}
          {...describedBy("message", fe.message, true)}
        />
      </Field>
      {maxQuantity > 1 && (
        <Field label="How many do you want?" htmlFor="quantity" error={fe.quantity}>
          <Input id="quantity" name="quantity" type="number" min={1} max={maxQuantity} defaultValue={state.values?.quantity ?? 1} className="w-28" />
        </Field>
      )}
      {maxQuantity === 1 && <input type="hidden" name="quantity" value="1" />}
      {negotiable && (
        <Field
          label="Make an offer (₹)"
          htmlFor="offer"
          optional
          error={fe.offer}
          hint={`Per ticket. Leave it blank to ask at ${formatPaise(askingPricePaise)}. Can't go above the asking price.`}
        >
          <Input id="offer" name="offer" inputMode="decimal" placeholder={String(Math.round((askingPricePaise * 0.9) / 100))} defaultValue={state.values?.offer ?? ""} className="w-36" {...describedBy("offer", fe.offer, true)} />
        </Field>
      )}
      <SubmitButton size="lg" pendingLabel="Sending…">Ask the seller</SubmitButton>
    </form>
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
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-ink">
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
