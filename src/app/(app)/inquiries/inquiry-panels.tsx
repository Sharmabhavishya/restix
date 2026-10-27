"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { MessageCircle } from "lucide-react";
import { answerOffer, close, confirm, offer, respond, withdraw } from "./actions";
import { formatPaise } from "@/lib/money";
import { Checkbox, Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";

const WA = /^https:\/\/wa\.me\/\d{8,15}(\?text=[^\s]*)?$/;

/** Shows what the seller shared. Only genuine wa.me links become links; everything else is text. */
export function SharedContact({ text }: { text: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-positive-soft px-4 py-3 text-[15px] text-positive-ink">
      {text.split("\n").map((line, i) =>
        WA.test(line) ? (
          <a key={i} href={line} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("dark", "sm", "my-1")}>
            Open WhatsApp chat
          </a>
        ) : (
          <p key={i} className="whitespace-pre-line">{line}</p>
        ),
      )}
    </div>
  );
}

export function RespondForm({ inquiryId, hasWhatsapp }: { inquiryId: string; hasWhatsapp: boolean }) {
  const [state, action] = useActionState(respond, initialState);
  const [mode, setMode] = useState<"idle" | "accept">("idle");
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {mode === "accept" ? (
        <form action={action} className="flex flex-col gap-4 rounded-[var(--radius-control)] bg-raised p-4">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="hidden" name="decision" value="accept" />
          {hasWhatsapp ? (
            <Checkbox id={`wa-${inquiryId}`} name="shareWhatsapp" defaultChecked label="Share my WhatsApp" hint="Only this buyer sees it." />
          ) : (
            <p className="text-[13px] text-muted">Add a WhatsApp number on your account page to share it in one tap.</p>
          )}
          <Field label="Or a note with how to reach you" htmlFor={`note-${inquiryId}`} optional error={state.fieldErrors?.note}>
            <Textarea id={`note-${inquiryId}`} name="note" rows={2} maxLength={200} placeholder="e.g. Insta @handle, or meet at the library steps 6pm" />
          </Field>
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Sharing…">Share & accept</SubmitButton>
            <button type="button" className={buttonClass("ghost")} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </form>
      ) : (
        <form action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <button type="button" className={buttonClass("primary")} onClick={() => setMode("accept")}>Accept</button>
          <SubmitButton name="decision" value="decline" variant="secondary" pendingLabel="Declining…">Decline</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function SmallAction({ inquiryId, kind }: { inquiryId: string; kind: "withdraw" | "close" }) {
  const [state, action] = useActionState(kind === "withdraw" ? withdraw : close, initialState);
  if (state.ok) return <span className="text-sm text-muted">{state.message}</span>;
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="…">{kind === "withdraw" ? "Withdraw request" : "Close conversation"}</SubmitButton>
      {state.error && <span className="text-[13px] text-negative">{state.error}</span>}
    </form>
  );
}

const OUTCOMES = [
  ["completed", "Done, ticket handed over"],
  ["not_completed", "Didn't happen"],
  ["disputed", "Something went wrong"],
] as const;

export function OutcomeForm({ inquiryId }: { inquiryId: string }) {
  const [state, action] = useActionState(confirm, initialState);
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <p className="text-sm font-medium">How did it go?</p>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map(([value, label]) => (
          <SubmitButton key={value} name="outcome" value={value} variant="secondary" size="sm" pendingLabel="Saving…">
            {label}
          </SubmitButton>
        ))}
      </div>
      <p className="text-[12px] text-muted">Private. Only counted in anonymous totals. If you got scammed, also report the listing or user.</p>
    </form>
  );
}

export interface OfferView {
  id: string;
  amountPaise: number;
  status: "open" | "accepted" | "declined" | "superseded" | "withdrawn";
  mine: boolean;
}

const OFFER_NOTE: Record<OfferView["status"], string> = {
  open: "waiting",
  accepted: "deal",
  declined: "passed",
  superseded: "countered",
  withdrawn: "withdrawn",
};

/**
 * The bargaining strip: each offer is a little price tab, newest last. Whoever didn't make the
 * open offer can take it, pass, or counter; whoever made it can pull it back.
 */
export function Bargain({
  inquiryId, offers, otherName, agreedPricePaise, canOffer, askingPricePaise,
}: {
  inquiryId: string;
  offers: OfferView[];
  otherName: string;
  agreedPricePaise: number | null;
  /** False when the conversation is closed or the buyer can't open bargaining on a fixed price. */
  canOffer: boolean;
  askingPricePaise: number;
}) {
  const [answerState, answerAction] = useActionState(answerOffer, initialState);
  const [offerState, offerAction] = useActionState(offer, initialState);
  const open = offers.find((o) => o.status === "open");
  const theirs = open && !open.mine;
  const fe = offerState.fieldErrors ?? {};
  const fieldId = `amount-${inquiryId}`;

  if (offers.length === 0 && !canOffer && agreedPricePaise === null) return null;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{agreedPricePaise !== null ? "Price agreed" : "Bargaining"}</p>
        <p className="text-[12px] text-muted">listed at {formatPaise(askingPricePaise)} · per ticket</p>
      </div>

      {offers.length > 0 && (
        <ol className="flex flex-wrap items-center gap-2" aria-label="Offers so far">
          {offers.map((o) => (
            <li key={o.id} className={`flex items-center gap-[2px] text-[13px] ${o.status === "superseded" || o.status === "withdrawn" || o.status === "declined" ? "opacity-60" : ""}`}>
              <span className={`rounded-l-[var(--radius-control)] px-2 py-1 ${o.mine ? "bg-accent-field text-accent-ink" : "bg-surface text-ink"}`}>
                {o.mine ? "you" : otherName}
              </span>
              <span className={`num rounded-r-full py-1 pr-3 pl-2 font-semibold ${o.status === "accepted" ? "bg-positive text-white" : o.mine ? "bg-accent-track text-accent-ink" : "bg-control/50 text-ink"} ${o.status === "superseded" || o.status === "withdrawn" ? "line-through" : ""}`}>
                {formatPaise(o.amountPaise)}
              </span>
              <span className="sr-only">, {OFFER_NOTE[o.status]}</span>
            </li>
          ))}
        </ol>
      )}

      {agreedPricePaise !== null ? (
        <p className="text-[15px] text-positive-ink">
          Deal at <span className="num font-semibold">{formatPaise(agreedPricePaise)}</span> a ticket. Pay at the handover, after you&apos;ve checked it.
        </p>
      ) : (
        <>
          {answerState.error && <Notice tone="error">{answerState.error}</Notice>}
          {offerState.error && <Notice tone="error">{offerState.error}</Notice>}
          {offerState.ok && <Notice tone="success">{offerState.message}</Notice>}
          {open && (
            <form action={answerAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="offerId" value={open.id} />
              {theirs ? (
                <>
                  <SubmitButton name="decision" value="accept" size="sm" pendingLabel="Locking it in…">
                    Take {formatPaise(open.amountPaise)}
                  </SubmitButton>
                  <SubmitButton name="decision" value="decline" variant="secondary" size="sm" pendingLabel="…">
                    Pass
                  </SubmitButton>
                </>
              ) : (
                <>
                  <span className="text-[13px] text-muted">waiting on {otherName}…</span>
                  <SubmitButton name="decision" value="withdraw" variant="ghost" size="sm" pendingLabel="…">
                    Withdraw offer
                  </SubmitButton>
                </>
              )}
            </form>
          )}
          {canOffer && !(open && open.mine) && (
            <form action={offerAction} className="flex flex-wrap items-end gap-2" noValidate>
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <div className="flex flex-col gap-1">
                <label htmlFor={fieldId} className="text-[13px] font-medium">{theirs ? "Or counter with" : "Your offer"} (₹)</label>
                <Input
                  id={fieldId}
                  name="amount"
                  inputMode="decimal"
                  placeholder={String(Math.round(askingPricePaise * 0.9 / 100))}
                  defaultValue={offerState.values?.amount ?? ""}
                  className="w-32"
                  {...describedBy(fieldId, fe.amount)}
                />
              </div>
              <SubmitButton variant="secondary" pendingLabel="Sending…">{theirs ? "Counter" : "Send offer"}</SubmitButton>
              {fe.amount && <p id={`${fieldId}-error`} className="w-full text-[13px] font-medium text-negative">{fe.amount}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
}

/** The buyer's WhatsApp button: opens a chat with the seller with the first message already written. */
export function WhatsAppSeller({ href, preview }: { href: string; preview: string }) {
  return (
    <div className="flex flex-col gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("dark", "md", "self-start")}>
        <MessageCircle className="size-4" aria-hidden /> Message on WhatsApp
      </a>
      <p className="text-[13px] text-muted">
        Opens WhatsApp with this ready to send: <span className="text-ink-soft">&ldquo;{preview}&rdquo;</span>
      </p>
    </div>
  );
}
