"use client";

import { useActionState } from "react";
import { initialState } from "@/lib/action-state";
import { decide, suggest } from "./actions";
import { Field, Input, Textarea, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

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
      <Field label="When" htmlFor="sg-date" optional error={fe.happensOn}>
        <Input id="sg-date" name="happensOn" type="date" defaultValue={state.values?.happensOn ?? ""} />
      </Field>
      <Field label="Anything that helps" htmlFor="sg-details" optional hint="Who's organising it, where it was announced, whether tickets can be resold.">
        <Textarea id="sg-details" name="details" rows={2} maxLength={1000} defaultValue={state.values?.details ?? ""} />
      </Field>
      <div>
        <SubmitButton variant="dark" pendingLabel="Sending…">Suggest event</SubmitButton>
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
        <SubmitButton name="status" value="added" variant="secondary" size="sm" pendingLabel="Saving…">Mark added</SubmitButton>
        <SubmitButton name="status" value="declined" variant="ghost" size="sm" pendingLabel="Saving…">Decline</SubmitButton>
      </div>
    </form>
  );
}
