"use client";

import { useActionState, useState } from "react";
import { initialState } from "@/lib/action-state";
import { deleteEventAction } from "../actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";

/** Admin-only danger zone: delete the event and everything listed under it, after typing its name. */
export function DeleteEvent({ eventId, name, listings }: { eventId: string; name: string; listings: number }) {
  const [state, action] = useActionState(deleteEventAction, initialState);
  const [open, setOpen] = useState(Boolean(state.error));
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <section aria-labelledby="danger-heading" className="mt-8 max-w-3xl rounded-[var(--radius-card)] border border-negative-line p-5 sm:p-7">
      <h2 id="danger-heading" className="text-lg font-semibold text-negative">Delete this event</h2>
      <p className="mt-1 text-sm text-muted">
        Permanently removes the event, its ticket types and {listings === 1 ? "its 1 listing" : `all ${listings} listings`}, with their requests and
        offers. Reports and the audit log keep their history. This can&apos;t be undone.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${buttonClass("danger")} mt-4`}>Delete event…</button>
      ) : (
        <form action={action} className="mt-5 flex flex-col gap-4">
          <input type="hidden" name="eventId" value={eventId} />
          {state.error && <Notice tone="error">{state.error}</Notice>}
          <Field label={`Type "${name}" to confirm`} htmlFor="confirmName">
            <Input id="confirmName" name="confirmName" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="delete-reason" hint="Goes in the audit log." error={state.fieldErrors?.reason}>
            <Textarea id="delete-reason" name="reason" rows={2} maxLength={1000} defaultValue={state.values?.reason ?? ""} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="danger" disabled={!matches} pendingLabel="Deleting…">Delete permanently</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
