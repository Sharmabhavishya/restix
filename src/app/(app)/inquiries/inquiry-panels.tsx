"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { close, confirm, respond, withdraw } from "./actions";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
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
